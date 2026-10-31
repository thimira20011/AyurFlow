//go:build integration

package consultations

import (
	"testing"

	"ayurflow/backend/internal/testutil"
)

func TestAssignmentAuditRollbackIntegration(t *testing.T) {
	pool := testutil.Postgres(t)
	ctx := t.Context()
	var admin, clinician, patient string
	for _, staff := range []struct {
		login, role string
		id          *string
	}{
		{"synthetic-assignment-admin", "administrator", &admin},
		{"synthetic-assignment-clinician", "clinician", &clinician},
	} {
		if err := pool.QueryRow(ctx, `INSERT INTO staff_accounts(login_identifier,password_hash)
			VALUES ($1,'$argon2id$synthetic-test-only') RETURNING id::text`, staff.login).Scan(staff.id); err != nil {
			t.Fatal(err)
		}
		if _, err := pool.Exec(ctx, `INSERT INTO staff_roles(staff_id,role_code) VALUES ($1,$2)`, *staff.id, staff.role); err != nil {
			t.Fatal(err)
		}
	}
	if err := pool.QueryRow(ctx, `INSERT INTO patients(display_name,created_by,updated_by)
		VALUES ('Synthetic assignment patient',$1,$1) RETURNING id::text`, admin).Scan(&patient); err != nil {
		t.Fatal(err)
	}
	service := NewAssignmentService(pool)
	if _, err := pool.Exec(ctx, `CREATE FUNCTION reject_assignment_audit() RETURNS trigger LANGUAGE plpgsql AS $$
		BEGIN IF NEW.action IN ('clinical_assignment.granted','clinical_assignment.revoked')
		THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$`); err != nil {
		t.Fatal(err)
	}
	addTrigger := func() {
		t.Helper()
		if _, err := pool.Exec(ctx, `CREATE TRIGGER reject_assignment_audit BEFORE INSERT ON audit_events
			FOR EACH ROW EXECUTE FUNCTION reject_assignment_audit()`); err != nil {
			t.Fatal(err)
		}
	}
	dropTrigger := func() {
		t.Helper()
		if _, err := pool.Exec(ctx, `DROP TRIGGER reject_assignment_audit ON audit_events`); err != nil {
			t.Fatal(err)
		}
	}
	addTrigger()
	if _, err := service.Grant(ctx, admin, patient, clinician); err == nil {
		t.Fatal("grant committed despite audit failure")
	}
	var count int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM patient_clinician_assignments`).Scan(&count); err != nil || count != 0 {
		t.Fatalf("failed grant changed assignments: %d %v", count, err)
	}
	dropTrigger()
	assignmentID, err := service.Grant(ctx, admin, patient, clinician)
	if err != nil || assignmentID == "" {
		t.Fatalf("grant: %s %v", assignmentID, err)
	}
	addTrigger()
	if err := service.Revoke(ctx, admin, patient, clinician); err == nil {
		t.Fatal("revoke committed despite audit failure")
	}
	var active bool
	if err := pool.QueryRow(ctx, `SELECT revoked_at IS NULL FROM patient_clinician_assignments WHERE id=$1`, assignmentID).Scan(&active); err != nil || !active {
		t.Fatalf("failed revoke changed assignment: active=%v err=%v", active, err)
	}
}
