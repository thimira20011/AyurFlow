//go:build integration

package clinical

import (
	"context"
	"errors"
	"testing"
	"time"

	"ayurflow/backend/internal/testutil"

	"github.com/jackc/pgx/v5"
)

type syntheticCancellation struct{}

func (syntheticCancellation) CancelFuture(ctx context.Context, tx pgx.Tx, planID string) error {
	_, err := tx.Exec(ctx, `UPDATE synthetic_future_sessions SET status='cancelled'
		WHERE plan_id=$1 AND status='planned'`, planID)
	return err
}

func TestPlanHoldResumeCancelAndClearanceIntegration(t *testing.T) {
	pool := testutil.Postgres(t)
	ctx := t.Context()
	var clinician, patient string
	if err := pool.QueryRow(ctx, `INSERT INTO staff_accounts(login_identifier,password_hash)
		VALUES ('synthetic-lifecycle-clinician','$argon2id$synthetic-test-only') RETURNING id::text`).Scan(&clinician); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO staff_roles(staff_id,role_code) VALUES ($1,'clinician')`, clinician); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO patients(display_name,created_by,updated_by)
		VALUES ('Synthetic lifecycle patient',$1,$1) RETURNING id::text`, clinician).Scan(&patient); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO patient_clinician_assignments(patient_id,clinician_id,granted_by)
		VALUES ($1,$2,$2)`, patient, clinician); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO consultations(patient_id,status,draft_text,signed_text,signed_by,signed_at,created_by,updated_by)
		VALUES ($1,'signed',NULL,'Synthetic signed assessment',$2,clock_timestamp(),$2,$2)`, patient, clinician); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `CREATE TABLE synthetic_future_sessions
		(plan_id uuid NOT NULL, status text NOT NULL)`); err != nil {
		t.Fatal(err)
	}
	service := NewService(pool, MemberBPathway(), &syntheticCompletion{allowed: true}, syntheticCancellation{})
	plan, err := service.Create(ctx, clinician, patient, "")
	if err != nil || plan.PathwayState != "PREPARATORY" {
		t.Fatalf("create pathway: %+v %v", plan, err)
	}
	var stageID, stageCode string
	if err := pool.QueryRow(ctx, `SELECT id::text,stage_code FROM plan_stages
		WHERE plan_id=$1 AND ordinal=1`, plan.ID).Scan(&stageID, &stageCode); err != nil || stageCode != "PREPARATORY" {
		t.Fatalf("first stage code=%s err=%v", stageCode, err)
	}
	clearance := func() error {
		return pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
			return RequireSessionClearance(ctx, tx, plan.ID, stageID)
		})
	}
	if err := clearance(); !errors.Is(err, ErrConflict) {
		t.Fatalf("unapproved stage cleared: %v", err)
	}
	if _, err := service.Hold(ctx, clinician, plan.ID, 1, " "); !errors.Is(err, ErrConflict) {
		t.Fatalf("blank hold reason accepted: %v", err)
	}
	plan, err = service.Approve(ctx, clinician, plan.ID, stageID, 1, MemberBPathway()[0].RequiredChecks)
	if err != nil {
		t.Fatal(err)
	}
	if err := clearance(); err != nil {
		t.Fatalf("approved current stage denied: %v", err)
	}
	startTx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if err := RequireSessionClearance(ctx, startTx, plan.ID, stageID); err != nil {
		startTx.Rollback(ctx)
		t.Fatalf("session start clearance: %v", err)
	}
	blockedCtx, stop := context.WithTimeout(ctx, 300*time.Millisecond)
	_, blockedErr := service.Hold(blockedCtx, clinician, plan.ID, plan.Version, "Concurrent pause")
	stop()
	if !errors.Is(blockedErr, context.DeadlineExceeded) {
		startTx.Rollback(ctx)
		t.Fatalf("hold did not wait for session-start transaction: %v", blockedErr)
	}
	if err := startTx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	plan, err = service.Hold(ctx, clinician, plan.ID, plan.Version, "Synthetic clinical pause")
	if err != nil || plan.Status != "held" {
		t.Fatalf("hold: %+v %v", plan, err)
	}
	if err := clearance(); !errors.Is(err, ErrConflict) {
		t.Fatalf("held plan cleared a new session: %v", err)
	}
	if _, err := service.Advance(ctx, clinician, plan.ID, plan.Version); !errors.Is(err, ErrConflict) {
		t.Fatalf("held plan advanced: %v", err)
	}
	plan, err = service.Resume(ctx, clinician, plan.ID, plan.Version, "Synthetic reassessment complete")
	if err != nil || plan.Status != "active" {
		t.Fatalf("resume: %+v %v", plan, err)
	}
	if err := clearance(); err != nil {
		t.Fatalf("resumed plan lost approval: %v", err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO synthetic_future_sessions(plan_id,status)
		VALUES ($1,'planned'),($1,'delivered')`, plan.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `CREATE FUNCTION reject_cancel_audit() RETURNS trigger LANGUAGE plpgsql AS $$
		BEGIN IF NEW.action='plan.cancel' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF;
		RETURN NEW; END $$`); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `CREATE TRIGGER reject_cancel_audit BEFORE INSERT ON audit_events
		FOR EACH ROW EXECUTE FUNCTION reject_cancel_audit()`); err != nil {
		t.Fatal(err)
	}
	if _, err := service.Cancel(ctx, clinician, plan.ID, plan.Version, "Synthetic cancellation"); err == nil {
		t.Fatal("cancellation committed despite audit failure")
	}
	var planned int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM synthetic_future_sessions
		WHERE plan_id=$1 AND status='planned'`, plan.ID).Scan(&planned); err != nil || planned != 1 {
		t.Fatalf("failed cancellation changed sessions: count=%d err=%v", planned, err)
	}
	if _, err := pool.Exec(ctx, `DROP TRIGGER reject_cancel_audit ON audit_events`); err != nil {
		t.Fatal(err)
	}
	plan, err = service.Cancel(ctx, clinician, plan.ID, plan.Version, "Synthetic cancellation")
	if err != nil || plan.Status != "cancelled" {
		t.Fatalf("cancel: %+v %v", plan, err)
	}
	if err := clearance(); !errors.Is(err, ErrConflict) {
		t.Fatalf("cancelled plan cleared a new session: %v", err)
	}
	var cancelled, delivered int
	if err := pool.QueryRow(ctx, `SELECT count(*) FILTER (WHERE status='cancelled'),
		count(*) FILTER (WHERE status='delivered') FROM synthetic_future_sessions WHERE plan_id=$1`,
		plan.ID).Scan(&cancelled, &delivered); err != nil || cancelled != 1 || delivered != 1 {
		t.Fatalf("cancelled/delivered history=%d/%d err=%v", cancelled, delivered, err)
	}
	if _, err := service.Resume(ctx, clinician, plan.ID, plan.Version, "not allowed"); !errors.Is(err, ErrConflict) {
		t.Fatalf("terminal cancellation resumed: %v", err)
	}
}
