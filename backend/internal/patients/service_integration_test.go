//go:build integration

package patients

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"ayurflow/backend/internal/testutil"

	"github.com/jackc/pgx/v5"
)

type testAccess struct {
	visible map[string]bool
}

func (a *testAccess) CanRegister(context.Context, pgx.Tx, string) error { return nil }
func (a *testAccess) CanSearch(context.Context, pgx.Tx, string) error   { return nil }
func (a *testAccess) CanRead(_ context.Context, _ pgx.Tx, _, id string) error {
	if a.visible != nil && !a.visible[id] {
		return ErrForbidden
	}
	return nil
}
func (a *testAccess) CanEdit(_ context.Context, _ pgx.Tx, _, id string, _ []string) error {
	return a.CanRead(context.Background(), nil, "", id)
}

func TestPatientServiceIntegration(t *testing.T) {
	pool := testutil.Postgres(t)
	ctx, cancel := context.WithTimeout(t.Context(), time.Minute)
	defer cancel()
	var actor string
	err := pool.QueryRow(ctx, `INSERT INTO staff_accounts(login_identifier, password_hash)
		VALUES ($1, '$argon2id$synthetic-test-only') RETURNING id::text`,
		"patient-service-"+time.Now().UTC().Format("20060102150405.000000000")).Scan(&actor)
	if err != nil {
		t.Fatal(err)
	}
	access := &testAccess{}
	service := NewService(pool, access)

	first, err := service.Create(ctx, actor, RegistrationInput{DisplayName: "සිංහල රෝගියා"})
	if err != nil || first.Identity != nil || first.Version != 1 {
		t.Fatalf("optional identity registration: patient=%+v err=%v", first, err)
	}
	second, err := service.Create(ctx, actor, RegistrationInput{DisplayName: "සිංහල දෙවන රෝගියා"})
	if err != nil || second.ID == first.ID {
		t.Fatalf("second optional identity registration: %v", err)
	}

	// The database's unique constraint, not a preflight lookup, arbitrates the race.
	var wg sync.WaitGroup
	results := make(chan error, 2)
	start := make(chan struct{})
	for _, name := range []string{"Race one", "Race two"} {
		wg.Add(1)
		go func(name string) {
			defer wg.Done()
			<-start
			_, err := service.Create(ctx, actor, RegistrationInput{
				DisplayName: name, Identity: &IdentityInput{Type: "NIC", Value: "1999-12345678v"},
			})
			results <- err
		}(name)
	}
	close(start)
	wg.Wait()
	close(results)
	successes, duplicates := 0, 0
	for err := range results {
		switch {
		case err == nil:
			successes++
		case errors.Is(err, ErrDuplicateIdentity):
			duplicates++
		default:
			t.Fatalf("unexpected race result: %v", err)
		}
	}
	if successes != 1 || duplicates != 1 {
		t.Fatalf("race results: success=%d duplicate=%d", successes, duplicates)
	}
	identityMatches, err := service.Search(ctx, actor, "1999 12345678 V")
	if err != nil || len(identityMatches) != 1 {
		t.Fatalf("normalized identity search: items=%+v err=%v", identityMatches, err)
	}
	idMatches, err := service.Search(ctx, actor, identityMatches[0].ID)
	if err != nil || len(idMatches) != 1 || idMatches[0].ID != identityMatches[0].ID {
		t.Fatalf("internal ID search: items=%+v err=%v", idMatches, err)
	}
	var racePatients int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM patients WHERE display_name IN ('Race one', 'Race two')`).Scan(&racePatients); err != nil || racePatients != 1 {
		t.Fatalf("duplicate must roll back whole registration: count=%d err=%v", racePatients, err)
	}

	access.visible = map[string]bool{first.ID: true}
	found, err := service.Search(ctx, actor, "සිංහල")
	if err != nil || len(found) != 1 || found[0].ID != first.ID {
		t.Fatalf("Unicode search must filter inaccessible records: items=%+v err=%v", found, err)
	}
	if _, err := service.Get(ctx, actor, second.ID); !errors.Is(err, ErrForbidden) {
		t.Fatalf("direct inaccessible read: %v", err)
	}
	phone := "071 000 0000"
	updated, err := service.Update(ctx, actor, first.ID, UpdateInput{
		Version: first.Version, Phone: OptionalString{Set: true, Value: &phone},
	})
	if err != nil || updated.Version != 2 || updated.Phone == nil || *updated.Phone != phone {
		t.Fatalf("audited update: patient=%+v err=%v", updated, err)
	}
	phoneMatches, err := service.Search(ctx, actor, "071 000")
	if err != nil || len(phoneMatches) != 1 || phoneMatches[0].ID != first.ID {
		t.Fatalf("contact search: items=%+v err=%v", phoneMatches, err)
	}
	if _, err := service.Update(ctx, actor, first.ID, UpdateInput{
		Version: first.Version, Phone: OptionalString{Set: true},
	}); !errors.Is(err, ErrStaleVersion) {
		t.Fatalf("stale update should fail: %v", err)
	}
	var auditCount int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM audit_events
		WHERE object_type='patient' AND object_id=$1 AND action='patient.updated'
		AND reason='demographic_correction' AND changed_fields=ARRAY['phone']::text[]`, first.ID).Scan(&auditCount); err != nil || auditCount != 1 {
		t.Fatalf("demographic audit missing: count=%d err=%v", auditCount, err)
	}

	// Force storage failure to prove patient changes and audit share one transaction.
	_, err = pool.Exec(ctx, `CREATE FUNCTION reject_patient_audit() RETURNS trigger LANGUAGE plpgsql AS $$
		BEGIN IF NEW.action = 'patient.updated' THEN
			RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$`)
	if err != nil {
		t.Fatal(err)
	}
	_, err = pool.Exec(ctx, `CREATE TRIGGER reject_patient_audit BEFORE INSERT ON audit_events
		FOR EACH ROW EXECUTE FUNCTION reject_patient_audit()`)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := service.Update(ctx, actor, first.ID, UpdateInput{
		Version: updated.Version, Phone: OptionalString{Set: true},
	}); err == nil {
		t.Fatal("audit failure should roll back demographic update")
	}
	current, err := service.Get(ctx, actor, first.ID)
	if err != nil || current.Version != 2 || current.Phone == nil || *current.Phone != phone {
		t.Fatalf("audit failure altered committed demographics: patient=%+v err=%v", current, err)
	}
}
