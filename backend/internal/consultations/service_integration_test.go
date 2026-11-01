//go:build integration

package consultations

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"

	"ayurflow/backend/internal/testutil"

	"github.com/jackc/pgx/v5"
)

type assignedAccess struct {
	actor   string
	patient string
}

func (a *assignedAccess) require(actor, patient string) error {
	if a.actor != actor || a.patient != patient {
		return ErrForbidden
	}
	return nil
}

func (a *assignedAccess) CanCreate(_ context.Context, _ pgx.Tx, actor, patient string) error {
	return a.require(actor, patient)
}
func (a *assignedAccess) CanList(_ context.Context, _ pgx.Tx, actor, patient string) error {
	return a.require(actor, patient)
}
func (a *assignedAccess) CanRead(_ context.Context, _ pgx.Tx, actor, patient, _ string) error {
	return a.require(actor, patient)
}
func (a *assignedAccess) CanEdit(_ context.Context, _ pgx.Tx, actor, patient, _ string) error {
	return a.require(actor, patient)
}

func TestConsultationDraftServiceIntegration(t *testing.T) {
	pool := testutil.Postgres(t)
	ctx, cancel := context.WithTimeout(t.Context(), time.Minute)
	defer cancel()
	var actor, other, patientID, otherPatientID string
	for i, target := range []*string{&actor, &other} {
		if err := pool.QueryRow(ctx, `INSERT INTO staff_accounts(login_identifier,password_hash)
			VALUES ($1, '$argon2id$synthetic-test-only') RETURNING id::text`,
			fmt.Sprintf("consultation-%d-%d", time.Now().UnixNano(), i)).Scan(target); err != nil {
			t.Fatal(err)
		}
	}
	for _, target := range []*string{&patientID, &otherPatientID} {
		if err := pool.QueryRow(ctx, `INSERT INTO patients(display_name,created_by,updated_by)
			VALUES ('Synthetic patient',$1,$1) RETURNING id::text`, actor).Scan(target); err != nil {
			t.Fatal(err)
		}
	}
	service := NewService(pool, &assignedAccess{actor: actor, patient: patientID})
	if _, err := service.Create(ctx, other, patientID, "Unauthorized note"); !errors.Is(err, ErrForbidden) {
		t.Fatalf("other actor created consultation: %v", err)
	}
	if _, err := service.Create(ctx, actor, otherPatientID, "Wrong patient"); !errors.Is(err, ErrForbidden) {
		t.Fatalf("other patient consultation created: %v", err)
	}
	created, err := service.Create(ctx, actor, patientID, "සිංහල synthetic draft")
	if err != nil || created.Status != "draft" || created.Version != 1 || created.PatientID != patientID {
		t.Fatalf("draft without plan: %+v, %v", created, err)
	}
	if got, err := service.Get(ctx, actor, patientID, created.ID); err != nil || got.DraftText != created.DraftText {
		t.Fatalf("authorized draft read: %+v, %v", got, err)
	}
	if _, err := service.Get(ctx, other, patientID, created.ID); !errors.Is(err, ErrForbidden) {
		t.Fatalf("other actor read clinical text: %v", err)
	}
	if _, err := service.Get(ctx, actor, patientID, otherPatientID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("unknown consultation must be hidden: %v", err)
	}

	// Concurrent edits with the same version serialize on the row; one is stale.
	var wg sync.WaitGroup
	results := make(chan error, 2)
	start := make(chan struct{})
	for _, note := range []string{"First edit", "Second edit"} {
		wg.Add(1)
		go func(note string) {
			defer wg.Done()
			<-start
			_, err := service.Update(ctx, actor, patientID, created.ID, created.Version, note)
			results <- err
		}(note)
	}
	close(start)
	wg.Wait()
	close(results)
	successes, stale := 0, 0
	for err := range results {
		switch {
		case err == nil:
			successes++
		case errors.Is(err, ErrStaleVersion):
			stale++
		default:
			t.Fatalf("edit race error: %v", err)
		}
	}
	if successes != 1 || stale != 1 {
		t.Fatalf("edit race: success=%d stale=%d", successes, stale)
	}
	current, err := service.Get(ctx, actor, patientID, created.ID)
	if err != nil || current.Version != 2 {
		t.Fatalf("committed draft after race: %+v, %v", current, err)
	}
	var auditCount, leakedBodies int
	if err := pool.QueryRow(ctx, `SELECT count(*), count(*) FILTER (WHERE reason IS NOT NULL)
		FROM audit_events WHERE object_type='consultation' AND object_id=$1`, created.ID).Scan(&auditCount, &leakedBodies); err != nil || auditCount != 2 || leakedBodies != 0 {
		t.Fatalf("audit metadata mismatch: count=%d reason-filled=%d err=%v", auditCount, leakedBodies, err)
	}
	// A failed audit insert must leave the committed draft and version intact.
	if _, err := pool.Exec(ctx, `CREATE FUNCTION reject_consultation_audit() RETURNS trigger LANGUAGE plpgsql AS $$
		BEGIN IF NEW.action='consultation.updated' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF;
		RETURN NEW; END $$`); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `CREATE TRIGGER reject_consultation_audit BEFORE INSERT ON audit_events
		FOR EACH ROW EXECUTE FUNCTION reject_consultation_audit()`); err != nil {
		t.Fatal(err)
	}
	if _, err := service.Update(ctx, actor, patientID, created.ID, current.Version, "Must roll back"); err == nil {
		t.Fatal("audit failure did not abort draft edit")
	}
	after, err := service.Get(ctx, actor, patientID, created.ID)
	if err != nil || after.Version != current.Version || after.DraftText != current.DraftText {
		t.Fatalf("failed audit changed draft: %+v, %v", after, err)
	}
}

func TestConsultationSigningAndAddendaIntegration(t *testing.T) {
	pool := testutil.Postgres(t)
	ctx, cancel := context.WithTimeout(t.Context(), time.Minute)
	defer cancel()
	var actor, other, patientID string
	for i, target := range []*string{&actor, &other} {
		if err := pool.QueryRow(ctx, `INSERT INTO staff_accounts(login_identifier,password_hash)
			VALUES ($1, '$argon2id$synthetic-test-only') RETURNING id::text`,
			fmt.Sprintf("consultation-sign-%d-%d", time.Now().UnixNano(), i)).Scan(target); err != nil {
			t.Fatal(err)
		}
	}
	if err := pool.QueryRow(ctx, `INSERT INTO patients(display_name,created_by,updated_by)
		VALUES ('Synthetic consultation patient',$1,$1) RETURNING id::text`, actor).Scan(&patientID); err != nil {
		t.Fatal(err)
	}
	service := NewService(pool, &assignedAccess{actor: actor, patient: patientID})
	draft, err := service.Create(ctx, actor, patientID, "සිංහල original draft")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := service.AddCorrection(ctx, actor, patientID, draft.ID, "Clarification", "Too early"); !errors.Is(err, ErrNotSigned) {
		t.Fatalf("draft accepted addendum: %v", err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO consultation_addenda(consultation_id,author_id,reason,body)
		VALUES ($1,$2,'Invalid direct insert','Before signing')`, draft.ID, actor); err == nil {
		t.Fatal("database accepted addendum to draft")
	}
	if _, err := service.Sign(ctx, other, patientID, draft.ID, draft.Version); !errors.Is(err, ErrForbidden) {
		t.Fatalf("unauthorized signature: %v", err)
	}
	if _, err := service.AddCorrection(ctx, actor, patientID, draft.ID, " ", "Invalid reason"); !errors.Is(err, ErrInvalidAddendum) {
		t.Fatalf("invalid reason accepted: %v", err)
	}
	if _, err := pool.Exec(ctx, `CREATE FUNCTION reject_sign_audit() RETURNS trigger LANGUAGE plpgsql AS $$
		BEGIN IF NEW.action='consultation.signed' THEN RAISE EXCEPTION 'synthetic sign audit failure'; END IF;
		RETURN NEW; END $$`); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `CREATE TRIGGER reject_sign_audit BEFORE INSERT ON audit_events
		FOR EACH ROW EXECUTE FUNCTION reject_sign_audit()`); err != nil {
		t.Fatal(err)
	}
	if _, err := service.Sign(ctx, actor, patientID, draft.ID, draft.Version); err == nil {
		t.Fatal("signing committed despite audit failure")
	}
	unchanged, err := service.Get(ctx, actor, patientID, draft.ID)
	if err != nil || unchanged.Status != "draft" || unchanged.Version != 1 || unchanged.DraftText != draft.DraftText {
		t.Fatalf("audit failure changed draft: %+v, %v", unchanged, err)
	}
	if _, err := pool.Exec(ctx, `DROP TRIGGER reject_sign_audit ON audit_events`); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `DROP FUNCTION reject_sign_audit()`); err != nil {
		t.Fatal(err)
	}

	// Sign and edit use the same version and row lock: only one wins.
	var wg sync.WaitGroup
	results := make(chan error, 2)
	start := make(chan struct{})
	for _, action := range []string{"sign", "edit"} {
		wg.Add(1)
		go func(action string) {
			defer wg.Done()
			<-start
			if action == "sign" {
				_, err := service.Sign(ctx, actor, patientID, draft.ID, draft.Version)
				results <- err
			} else {
				_, err := service.Update(ctx, actor, patientID, draft.ID, draft.Version, "Updated before sign")
				results <- err
			}
		}(action)
	}
	close(start)
	wg.Wait()
	close(results)
	success, rejected := 0, 0
	for err := range results {
		switch {
		case err == nil:
			success++
		case errors.Is(err, ErrStaleVersion), errors.Is(err, ErrNotDraft):
			rejected++
		default:
			t.Fatalf("sign/edit race: %v", err)
		}
	}
	if success != 1 || rejected != 1 {
		t.Fatalf("sign/edit race: success=%d rejected=%d", success, rejected)
	}
	current, err := service.Get(ctx, actor, patientID, draft.ID)
	if err != nil {
		t.Fatal(err)
	}
	if current.Status == "draft" {
		current, err = service.Sign(ctx, actor, patientID, draft.ID, current.Version)
		if err != nil {
			t.Fatal(err)
		}
	}
	if current.Status != "signed" || current.DraftText != "" || current.SignedText == "" || current.SignedBy != actor || current.SignedAt == nil {
		t.Fatalf("signed projection invalid: %+v", current)
	}
	if _, err := service.Update(ctx, actor, patientID, draft.ID, current.Version, "Overwrite"); !errors.Is(err, ErrNotDraft) {
		t.Fatalf("signed original edited: %v", err)
	}
	if _, err := service.Sign(ctx, actor, patientID, draft.ID, current.Version); !errors.Is(err, ErrNotDraft) {
		t.Fatalf("second signature accepted: %v", err)
	}
	competingDraft, err := service.Create(ctx, actor, patientID, "Competing signatures")
	if err != nil {
		t.Fatal(err)
	}
	var signWG sync.WaitGroup
	signResults := make(chan error, 2)
	signStart := make(chan struct{})
	for range 2 {
		signWG.Add(1)
		go func() {
			defer signWG.Done()
			<-signStart
			_, err := service.Sign(ctx, actor, patientID, competingDraft.ID, competingDraft.Version)
			signResults <- err
		}()
	}
	close(signStart)
	signWG.Wait()
	close(signResults)
	signSuccess, signRejected := 0, 0
	for err := range signResults {
		switch {
		case err == nil:
			signSuccess++
		case errors.Is(err, ErrNotDraft):
			signRejected++
		default:
			t.Fatalf("competing signature error: %v", err)
		}
	}
	if signSuccess != 1 || signRejected != 1 {
		t.Fatalf("competing signatures: success=%d rejected=%d", signSuccess, signRejected)
	}
	if _, err := service.Get(ctx, other, patientID, draft.ID); !errors.Is(err, ErrForbidden) {
		t.Fatalf("unauthorized signed read: %v", err)
	}
	if _, err := pool.Exec(ctx, `UPDATE consultations SET signed_text='tampered' WHERE id=$1`, draft.ID); err == nil {
		t.Fatal("direct SQL altered signed original")
	}
	if _, err := pool.Exec(ctx, `DELETE FROM consultations WHERE id=$1`, draft.ID); err == nil {
		t.Fatal("direct SQL deleted signed original")
	}
	first, err := service.AddCorrection(ctx, actor, patientID, draft.ID, "පැහැදිලි කිරීම", "First synthetic correction")
	if err != nil {
		t.Fatal(err)
	}
	if first.AuthorID != actor || first.CreatedAt.IsZero() || first.Reason != "පැහැදිලි කිරීම" {
		t.Fatalf("addendum attribution missing: %+v", first)
	}
	second, err := service.AddCorrection(ctx, actor, patientID, draft.ID, "Further detail", "Second synthetic correction")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := service.AddCorrection(ctx, other, patientID, draft.ID, "Unauthorized", "No access"); !errors.Is(err, ErrForbidden) {
		t.Fatalf("unauthorized addendum: %v", err)
	}
	if _, err := pool.Exec(ctx, `UPDATE consultation_addenda SET body='tampered' WHERE id=$1`, first.ID); err == nil {
		t.Fatal("direct SQL altered addendum")
	}
	if _, err := pool.Exec(ctx, `DELETE FROM consultation_addenda WHERE id=$1`, first.ID); err == nil {
		t.Fatal("direct SQL deleted addendum")
	}
	if _, err := pool.Exec(ctx, `TRUNCATE consultation_addenda`); err == nil {
		t.Fatal("direct SQL truncated addenda")
	}
	read, err := service.Get(ctx, actor, patientID, draft.ID)
	if err != nil || read.SignedText != current.SignedText || len(read.Addenda) != 2 || read.Addenda[0].ID != first.ID || read.Addenda[1].ID != second.ID {
		t.Fatalf("signed history changed: %+v, %v", read, err)
	}
	var leaked int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM audit_events WHERE
		(object_type='consultation' AND object_id=$1 OR object_type='consultation_addendum' AND object_id IN ($2,$3))
		AND (reason IS NOT NULL OR array_to_string(changed_fields, ',') LIKE '%synthetic%')`, draft.ID, first.ID, second.ID).Scan(&leaked); err != nil || leaked != 0 {
		t.Fatalf("audit contains clinical text or reason: count=%d err=%v", leaked, err)
	}
	if _, err := pool.Exec(ctx, `CREATE FUNCTION reject_addendum_audit() RETURNS trigger LANGUAGE plpgsql AS $$
		BEGIN IF NEW.action='consultation.addendum_created' THEN RAISE EXCEPTION 'synthetic addendum audit failure'; END IF;
		RETURN NEW; END $$`); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `CREATE TRIGGER reject_addendum_audit BEFORE INSERT ON audit_events
		FOR EACH ROW EXECUTE FUNCTION reject_addendum_audit()`); err != nil {
		t.Fatal(err)
	}
	if _, err := service.AddCorrection(ctx, actor, patientID, draft.ID, "Must roll back", "Uncommitted text"); err == nil {
		t.Fatal("addendum committed despite audit failure")
	}
	read, err = service.Get(ctx, actor, patientID, draft.ID)
	if err != nil || len(read.Addenda) != 2 || read.SignedText != current.SignedText {
		t.Fatalf("failed audit changed signed history: %+v, %v", read, err)
	}
}
