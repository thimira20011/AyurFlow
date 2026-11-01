//go:build integration

package consultations

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"ayurflow/backend/internal/testutil"
)

func TestAssignedConsultationAccessIntegration(t *testing.T) {
	pool := testutil.Postgres(t)
	ctx := t.Context()
	var clinician, other, patientID string
	for _, account := range []struct {
		login string
		id    *string
	}{
		{"synthetic-clinician", &clinician}, {"synthetic-other", &other},
	} {
		if err := pool.QueryRow(ctx, `INSERT INTO staff_accounts(login_identifier,password_hash)
			VALUES ($1,'$argon2id$synthetic-test-only') RETURNING id::text`, account.login).Scan(account.id); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := pool.Exec(ctx, `INSERT INTO staff_roles(staff_id,role_code) VALUES($1,'clinician')`, clinician); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO patients(display_name,created_by,updated_by)
		VALUES ('Synthetic access patient',$1,$1) RETURNING id::text`, clinician).Scan(&patientID); err != nil {
		t.Fatal(err)
	}
	service := NewService(pool, AssignedPolicy{})
	if _, err := service.Create(ctx, clinician, patientID, "Denied before assignment"); !errors.Is(err, ErrForbidden) {
		t.Fatalf("unassigned clinician created a draft: %v", err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO patient_clinician_assignments(patient_id,clinician_id,granted_by)
		VALUES ($1,$2,$2)`, patientID, clinician); err != nil {
		t.Fatal(err)
	}
	created, err := service.Create(ctx, clinician, patientID, "Synthetic සිංහල draft")
	if err != nil {
		t.Fatal(err)
	}
	items, err := service.List(ctx, clinician, patientID)
	if err != nil || len(items) != 1 || items[0].ID != created.ID {
		t.Fatalf("assigned list: %+v, %v", items, err)
	}
	encoded, err := json.Marshal(items)
	if err != nil || strings.Contains(string(encoded), "සිංහල") {
		t.Fatal("list summary included a clinical body")
	}
	if found, err := service.GetByID(ctx, clinician, created.ID); err != nil || found.DraftText != created.DraftText {
		t.Fatalf("assigned detail: %+v, %v", found, err)
	}
	if _, err := service.List(ctx, other, patientID); !errors.Is(err, ErrForbidden) {
		t.Fatalf("role-less actor listed notes: %v", err)
	}
	if _, err := service.GetByID(ctx, other, created.ID); !errors.Is(err, ErrForbidden) {
		t.Fatalf("role-less actor read a note: %v", err)
	}
	if _, err := service.UpdateByID(ctx, clinician, created.ID, created.Version, "Synthetic edit"); err != nil {
		t.Fatalf("assigned versioned edit: %v", err)
	}
	if _, err := pool.Exec(ctx, `UPDATE patient_clinician_assignments
		SET revoked_at=clock_timestamp(), revoked_by=$2
		WHERE patient_id=$1 AND clinician_id=$2 AND revoked_at IS NULL`, patientID, clinician); err != nil {
		t.Fatal(err)
	}
	if _, err := service.GetByID(ctx, clinician, created.ID); !errors.Is(err, ErrForbidden) {
		t.Fatalf("revoked clinician read a note: %v", err)
	}
	if _, err := service.UpdateByID(ctx, clinician, created.ID, created.Version+1, "Denied edit"); !errors.Is(err, ErrForbidden) {
		t.Fatalf("revoked clinician edited a note: %v", err)
	}
}
