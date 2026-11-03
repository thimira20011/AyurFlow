//go:build integration

package clinical

import (
	"context"
	"errors"
	"testing"

	"ayurflow/backend/internal/testutil"

	"github.com/jackc/pgx/v5"
)

type syntheticCompletion struct{ allowed bool }

func (c *syntheticCompletion) CanComplete(_ context.Context, _ pgx.Tx, _, _ string) error {
	if !c.allowed {
		return ErrCompletionPending
	}
	return nil
}

func TestPlanActionsIntegration(t *testing.T) {
	pool := testutil.Postgres(t)
	ctx := t.Context()
	var clinician, receptionist, patient string
	for _, entry := range []struct {
		login, role string
		id          *string
	}{
		{"synthetic-plan-clinician", "clinician", &clinician},
		{"synthetic-plan-reception", "receptionist", &receptionist},
	} {
		if err := pool.QueryRow(ctx, `INSERT INTO staff_accounts(login_identifier,password_hash)
			VALUES ($1,'$argon2id$synthetic-test-only') RETURNING id::text`, entry.login).Scan(entry.id); err != nil {
			t.Fatal(err)
		}
		if _, err := pool.Exec(ctx, `INSERT INTO staff_roles(staff_id,role_code) VALUES ($1,$2)`, *entry.id, entry.role); err != nil {
			t.Fatal(err)
		}
	}
	if err := pool.QueryRow(ctx, `INSERT INTO patients(display_name,created_by,updated_by)
		VALUES ('Synthetic care plan patient',$1,$1) RETURNING id::text`, receptionist).Scan(&patient); err != nil {
		t.Fatal(err)
	}
	completion := &syntheticCompletion{}
	pathway := MemberBPathway()
	service := NewService(pool, pathway, completion)
	if _, err := service.Create(ctx, clinician, patient, ""); !errors.Is(err, ErrForbidden) {
		t.Fatalf("unassigned create: %v", err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO patient_clinician_assignments(patient_id,clinician_id,granted_by)
		VALUES ($1,$2,$3)`, patient, clinician, receptionist); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO consultations(patient_id,status,draft_text,signed_text,signed_by,signed_at,created_by,updated_by)
		VALUES ($1,'signed',NULL,'Synthetic signed consultation',$2,clock_timestamp(),$2,$2)`, patient, clinician); err != nil {
		t.Fatal(err)
	}
	if _, err := service.Create(ctx, receptionist, patient, ""); !errors.Is(err, ErrForbidden) {
		t.Fatalf("reception create: %v", err)
	}
	plan, err := service.Create(ctx, clinician, patient, "")
	if err != nil || plan.Status != "draft" || plan.PathwayState != "NOT_STARTED" || plan.CurrentOrdinal != 0 || plan.Version != 1 {
		t.Fatalf("create: %+v %v", plan, err)
	}
	if _, err := service.Approve(ctx, clinician, plan.ID, "00000000-0000-4000-8000-000000000001", plan.Version, pathway[0].RequiredChecks); !errors.Is(err, ErrConflict) {
		t.Fatalf("draft stage approved: %v", err)
	}
	if _, err := pool.Exec(ctx, `CREATE FUNCTION reject_start_audit() RETURNS trigger LANGUAGE plpgsql AS $$
		BEGIN IF NEW.action='plan.started' THEN RAISE EXCEPTION 'synthetic start audit failure'; END IF;
		RETURN NEW; END $$`); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `CREATE TRIGGER reject_start_audit BEFORE INSERT ON audit_events
		FOR EACH ROW EXECUTE FUNCTION reject_start_audit()`); err != nil {
		t.Fatal(err)
	}
	if _, err := service.Start(ctx, clinician, plan.ID, plan.Version); err == nil {
		t.Fatal("plan start committed despite failed audit")
	}
	var startStatus string
	var startVersion int64
	if err := pool.QueryRow(ctx, `SELECT status,record_version FROM care_plans WHERE id=$1`, plan.ID).Scan(&startStatus, &startVersion); err != nil || startStatus != "draft" || startVersion != 1 {
		t.Fatalf("failed start changed plan status=%s version=%d err=%v", startStatus, startVersion, err)
	}
	if _, err := pool.Exec(ctx, `DROP TRIGGER reject_start_audit ON audit_events`); err != nil {
		t.Fatal(err)
	}
	plan, err = service.Start(ctx, clinician, plan.ID, plan.Version)
	if err != nil || plan.Status != "active" || plan.PathwayState != "PREPARATORY" || plan.CurrentOrdinal != 1 || plan.Version != 2 {
		t.Fatalf("start: %+v %v", plan, err)
	}
	if _, err := service.Start(ctx, clinician, plan.ID, 1); !errors.Is(err, ErrConflict) {
		t.Fatalf("stage restarted: %v", err)
	}
	var first, second, third string
	if err := pool.QueryRow(ctx, `SELECT id::text FROM plan_stages WHERE plan_id=$1 AND ordinal=1`, plan.ID).Scan(&first); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `SELECT id::text FROM plan_stages WHERE plan_id=$1 AND ordinal=2`, plan.ID).Scan(&second); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `SELECT id::text FROM plan_stages WHERE plan_id=$1 AND ordinal=3`, plan.ID).Scan(&third); err != nil {
		t.Fatal(err)
	}
	if _, err := service.Approve(ctx, clinician, plan.ID, second, plan.Version, pathway[1].RequiredChecks); !errors.Is(err, ErrConflict) {
		t.Fatalf("future stage approved: %v", err)
	}
	if _, err := service.Approve(ctx, clinician, plan.ID, first, plan.Version, nil); !errors.Is(err, ErrConflict) {
		t.Fatalf("missing checklist approved: %v", err)
	}
	if _, err := service.Approve(ctx, receptionist, plan.ID, first, plan.Version, pathway[0].RequiredChecks); !errors.Is(err, ErrForbidden) {
		t.Fatalf("reception approval: %v", err)
	}
	if _, err := pool.Exec(ctx, `CREATE FUNCTION reject_plan_audit() RETURNS trigger LANGUAGE plpgsql AS $$
		BEGIN IF NEW.action='plan.stage_approved' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF;
		RETURN NEW; END $$`); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `CREATE TRIGGER reject_plan_audit BEFORE INSERT ON audit_events
		FOR EACH ROW EXECUTE FUNCTION reject_plan_audit()`); err != nil {
		t.Fatal(err)
	}
	if _, err := service.Approve(ctx, clinician, plan.ID, first, plan.Version, pathway[0].RequiredChecks); err == nil {
		t.Fatal("approval committed despite audit failure")
	}
	if _, err := pool.Exec(ctx, `DROP TRIGGER reject_plan_audit ON audit_events`); err != nil {
		t.Fatal(err)
	}
	var status string
	var version int64
	if err := pool.QueryRow(ctx, `SELECT status FROM plan_stages WHERE id=$1`, first).Scan(&status); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `SELECT record_version FROM care_plans WHERE id=$1`, plan.ID).Scan(&version); err != nil {
		t.Fatal(err)
	}
	if status != "pending" || version != 2 {
		t.Fatalf("failed audit changed stage=%s version=%d", status, version)
	}
	plan, err = service.Approve(ctx, clinician, plan.ID, first, 2, pathway[0].RequiredChecks)
	if err != nil || plan.Version != 3 {
		t.Fatalf("approve: %+v %v", plan, err)
	}
	if _, err := service.Approve(ctx, clinician, plan.ID, first, 2, pathway[0].RequiredChecks); !errors.Is(err, ErrConflict) {
		t.Fatalf("stale approval: %v", err)
	}
	if _, err := service.Advance(ctx, clinician, plan.ID, 3); !errors.Is(err, ErrCompletionPending) {
		t.Fatalf("completion gate bypassed: %v", err)
	}
	completion.allowed = true
	plan, err = service.Advance(ctx, clinician, plan.ID, 3)
	if err != nil || plan.CurrentOrdinal != 2 || plan.Version != 4 {
		t.Fatalf("advance: %+v %v", plan, err)
	}
	if _, err := service.Advance(ctx, clinician, plan.ID, 4); !errors.Is(err, ErrConflict) {
		t.Fatalf("unapproved second stage advanced: %v", err)
	}
	plan, err = service.Approve(ctx, clinician, plan.ID, second, 4, pathway[1].RequiredChecks)
	if err != nil {
		t.Fatal(err)
	}
	plan, err = service.Advance(ctx, clinician, plan.ID, plan.Version)
	if err != nil || plan.Status != "active" || plan.PathwayState != "RECOVERY" || plan.Version != 6 {
		t.Fatalf("recovery transition: %+v %v", plan, err)
	}
	plan, err = service.Approve(ctx, clinician, plan.ID, third, plan.Version, pathway[2].RequiredChecks)
	if err != nil {
		t.Fatal(err)
	}
	plan, err = service.Advance(ctx, clinician, plan.ID, plan.Version)
	if err != nil || plan.Status != "completed" || plan.PathwayState != "COMPLETED" || plan.Version != 8 {
		t.Fatalf("finish: %+v %v", plan, err)
	}
	if _, err := service.Advance(ctx, clinician, plan.ID, plan.Version); !errors.Is(err, ErrConflict) {
		t.Fatalf("completed plan advanced: %v", err)
	}
	if _, err := pool.Exec(ctx, `UPDATE care_plans SET status='active' WHERE id=$1`, plan.ID); err == nil {
		t.Fatal("terminal plan was edited directly")
	}
	if _, err := pool.Exec(ctx, `INSERT INTO plan_stages(plan_id,ordinal,label) VALUES ($1,4,'UNAPPROVED')`, plan.ID); err == nil {
		t.Fatal("stage added to completed plan")
	}
	var decisions, events int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM plan_decisions WHERE plan_id=$1`, plan.ID).Scan(&decisions); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM audit_events WHERE object_type='care_plan' AND object_id=$1`, plan.ID).Scan(&events); err != nil {
		t.Fatal(err)
	}
	if decisions != 7 || events != 8 {
		t.Fatalf("decision/audit history %d/%d", decisions, events)
	}
}
