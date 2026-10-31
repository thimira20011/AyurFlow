//go:build integration

package administration

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"sync"
	"testing"
	"time"

	"ayurflow/backend/internal/auth"
	"ayurflow/backend/internal/config"
	"ayurflow/backend/internal/testutil"

	"github.com/jackc/pgx/v5/pgxpool"
)

const syntheticPassword = "synthetic-initial-password"

func staffFixture(t *testing.T) (*Service, *auth.Service, *pgxpool.Pool, string) {
	t.Helper()
	pool := testutil.Postgres(t)
	hash, err := auth.HashPassword(syntheticPassword)
	if err != nil {
		t.Fatal(err)
	}
	var actor string
	err = pool.QueryRow(t.Context(), `INSERT INTO staff_accounts(login_identifier,password_hash) VALUES('synthetic-owner',$1) RETURNING id::text`, hash).Scan(&actor)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(t.Context(), `INSERT INTO staff_roles(staff_id,role_code) VALUES($1,'administrator')`, actor); err != nil {
		t.Fatal(err)
	}
	sessions := auth.NewService(pool, config.AuthPolicy{IdleTimeout: time.Hour, AbsoluteTimeout: 8 * time.Hour, AttemptLimit: 5, AttemptWindow: time.Minute, BlockDuration: time.Minute})
	return NewService(pool), sessions, pool, actor
}

func TestStaffManagementIntegration(t *testing.T) {
	service, sessions, pool, actor := staffFixture(t)
	ctx := t.Context()
	created, err := service.Create(ctx, actor, CreateInput{LoginIdentifier: " Synthetic-New ", Password: syntheticPassword, Roles: []string{"receptionist"}})
	if err != nil {
		t.Fatal(err)
	}
	if created.LoginIdentifier != "synthetic-new" || !created.Active {
		t.Fatal("account was not normalized/active")
	}
	var hash string
	if err := pool.QueryRow(ctx, `SELECT password_hash FROM staff_accounts WHERE id=$1`, created.ID).Scan(&hash); err != nil {
		t.Fatal(err)
	}
	valid, err := auth.VerifyPassword(syntheticPassword, hash)
	if err != nil || !valid || hash == syntheticPassword {
		t.Fatal("credential not hashed correctly")
	}
	page, err := service.List(ctx, actor, "")
	if err != nil {
		t.Fatal(err)
	}
	encoded, _ := json.Marshal(page)
	if strings.Contains(string(encoded), syntheticPassword) || strings.Contains(string(encoded), "password_hash") || strings.Contains(string(encoded), "$argon2id$") {
		t.Fatal("staff response exposed credentials")
	}
	_, token, err := sessions.Login(ctx, created.LoginIdentifier, syntheticPassword, "")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := service.List(ctx, created.ID, ""); !errors.Is(err, ErrForbidden) {
		t.Fatalf("reception acquired admin access: %v", err)
	}
	if _, err := service.SetRoles(ctx, actor, created.ID, []string{"clinician"}); err != nil {
		t.Fatal(err)
	}
	if _, err := sessions.Authenticate(ctx, token); !errors.Is(err, auth.ErrSession) {
		t.Fatal("role change retained session")
	}
	_, token, err = sessions.Login(ctx, created.LoginIdentifier, syntheticPassword, "")
	if err != nil {
		t.Fatal(err)
	}
	if err := service.Disable(ctx, actor, created.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := sessions.Authenticate(ctx, token); !errors.Is(err, auth.ErrSession) {
		t.Fatal("disable retained session")
	}
	if _, _, err := sessions.Login(ctx, created.LoginIdentifier, syntheticPassword, ""); !errors.Is(err, auth.ErrCredentials) {
		t.Fatal("disabled account could login")
	}
	if err := service.Disable(ctx, actor, created.ID); err != nil {
		t.Fatal("disable retry failed")
	}
	var disabledAudits int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM audit_events WHERE action='staff.disabled'`).Scan(&disabledAudits); err != nil || disabledAudits != 1 {
		t.Fatalf("disable audit retry=%d error=%v", disabledAudits, err)
	}
	if _, err := service.SetRoles(ctx, actor, created.ID, []string{"billing"}); !errors.Is(err, ErrConflict) {
		t.Fatal("disabled target roles changed")
	}
	for _, target := range []string{strings.ToUpper(actor), strings.ReplaceAll(actor, "-", "")} {
		if err := service.Disable(ctx, actor, target); !errors.Is(err, ErrConflict) {
			t.Fatalf("self-disable spelling bypass: %v", err)
		}
		if _, err := service.SetRoles(ctx, actor, target, []string{"receptionist"}); !errors.Is(err, ErrConflict) {
			t.Fatalf("self-demotion spelling bypass: %v", err)
		}
	}
	if _, err := service.Create(ctx, actor, CreateInput{LoginIdentifier: "synthetic-new", Password: syntheticPassword, Roles: []string{"billing"}}); !errors.Is(err, ErrConflict) {
		t.Fatalf("duplicate account=%v", err)
	}
	if _, err := service.Create(ctx, actor, CreateInput{LoginIdentifier: "invalid-role", Password: syntheticPassword, Roles: []string{"unknown-role"}}); !errors.Is(err, ErrInvalid) {
		t.Fatalf("unknown role=%v", err)
	}
}

func TestStaffAuditFailureRollsBackIntegration(t *testing.T) {
	service, sessions, pool, actor := staffFixture(t)
	ctx := t.Context()
	target, err := service.Create(ctx, actor, CreateInput{LoginIdentifier: "synthetic-target", Password: syntheticPassword, Roles: []string{"billing"}})
	if err != nil {
		t.Fatal(err)
	}
	_, token, err := sessions.Login(ctx, target.LoginIdentifier, syntheticPassword, "")
	if err != nil {
		t.Fatal(err)
	}
	_, err = pool.Exec(ctx, `CREATE FUNCTION reject_staff_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic audit failure'; END; $$;
		CREATE TRIGGER reject_staff_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_staff_audit()`)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := service.Create(ctx, actor, CreateInput{LoginIdentifier: "must-rollback", Password: syntheticPassword, Roles: []string{"billing"}}); err == nil {
		t.Fatal("create ignored failed audit")
	}
	if _, err := service.SetRoles(ctx, actor, target.ID, []string{"clinician"}); err == nil {
		t.Fatal("roles ignored failed audit")
	}
	if err := service.Disable(ctx, actor, target.ID); err == nil {
		t.Fatal("disable ignored failed audit")
	}
	var active bool
	var roles []string
	var failedCreates int
	err = pool.QueryRow(ctx, `SELECT active,ARRAY(SELECT role_code FROM staff_roles WHERE staff_id=$1) FROM staff_accounts WHERE id=$1`, target.ID).Scan(&active, &roles)
	if err != nil || !active || len(roles) != 1 || roles[0] != "billing" {
		t.Fatalf("failed audit changed staff state: %v", err)
	}
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM staff_accounts WHERE login_identifier='must-rollback'`).Scan(&failedCreates); err != nil || failedCreates != 0 {
		t.Fatal("failed audit retained created account")
	}
	if _, err := sessions.Authenticate(ctx, token); err != nil {
		t.Fatalf("failed audit still revoked session: %v", err)
	}
}

func TestConcurrentAdministratorChangesIntegration(t *testing.T) {
	for _, mode := range []string{"disable", "demote"} {
		t.Run(mode, func(t *testing.T) {
			service, _, pool, first := staffFixture(t)
			second, err := service.Create(t.Context(), first, CreateInput{LoginIdentifier: "synthetic-other-admin", Password: syntheticPassword, Roles: []string{"administrator"}})
			if err != nil {
				t.Fatal(err)
			}
			ctx, cancel := context.WithTimeout(t.Context(), 10*time.Second)
			var workers sync.WaitGroup
			defer func() { cancel(); workers.Wait() }()
			start := make(chan struct{})
			results := make(chan error, 2)
			for _, pair := range [][2]string{{first, second.ID}, {second.ID, first}} {
				workers.Add(1)
				go func() {
					defer workers.Done()
					<-start
					if mode == "disable" {
						results <- service.Disable(ctx, pair[0], pair[1])
					} else {
						_, err := service.SetRoles(ctx, pair[0], pair[1], []string{"receptionist"})
						results <- err
					}
				}()
			}
			close(start)
			success, denied := 0, 0
			for range 2 {
				select {
				case err := <-results:
					if err == nil {
						success++
					} else if errors.Is(err, ErrForbidden) {
						denied++
					} else {
						t.Fatal(err)
					}
				case <-ctx.Done():
					t.Fatal("administrator changes did not complete")
				}
			}
			var administrators int
			err = pool.QueryRow(ctx, `SELECT count(*) FROM staff_accounts s JOIN staff_roles r ON r.staff_id=s.id WHERE s.active AND r.role_code='administrator'`).Scan(&administrators)
			if err != nil || success != 1 || denied != 1 || administrators != 1 {
				t.Fatalf("last administrator lost: success=%d denied=%d active=%d error=%v", success, denied, administrators, err)
			}
		})
	}
}
