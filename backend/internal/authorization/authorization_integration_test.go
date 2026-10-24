//go:build integration

package authorization

import (
	"context"
	"errors"
	"testing"

	"ayurflow/backend/internal/patients"
	"ayurflow/backend/internal/testutil"

	"github.com/jackc/pgx/v5"
)

func TestRoleAndRecordAccessIntegration(t *testing.T) {
	pool := testutil.Postgres(t)
	ctx := t.Context()
	var receptionist, clinician, administrator, patient string
	for _, seed := range []struct {
		role string
		id   *string
	}{
		{role: "receptionist", id: &receptionist},
		{role: "clinician", id: &clinician},
		{role: "administrator", id: &administrator},
	} {
		err := pool.QueryRow(ctx, `INSERT INTO staff_accounts(login_identifier,password_hash)
			VALUES ($1,'$argon2id$synthetic-fixture') RETURNING id::text`, seed.role).Scan(seed.id)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := pool.Exec(ctx, `INSERT INTO staff_roles(staff_id,role_code) VALUES($1,$2)`, *seed.id, seed.role); err != nil {
			t.Fatal(err)
		}
	}
	if err := pool.QueryRow(ctx, `INSERT INTO patients(display_name,created_by,updated_by)
		VALUES('Synthetic permission fixture',$1,$1) RETURNING id::text`, receptionist).Scan(&patient); err != nil {
		t.Fatal(err)
	}
	policy := &PatientPolicy{}
	for _, tc := range []struct {
		name, actor string
		wantAllowed bool
	}{
		{name: "reception demographics", actor: receptionist, wantAllowed: true},
		{name: "administrator is not reception", actor: administrator},
		{name: "clinician receives no unrestricted demographics", actor: clinician},
	} {
		t.Run(tc.name, func(t *testing.T) {
			err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error { return policy.CanRead(ctx, tx, tc.actor, patient) })
			if (err == nil) != tc.wantAllowed || (!tc.wantAllowed && !errors.Is(err, patients.ErrForbidden)) {
				t.Fatalf("unexpected permission result: %v", err)
			}
		})
	}
	for _, tc := range []struct {
		name, actor string
		action      Action
		target      Resource
	}{
		{name: "administrator clinical denial", actor: administrator, action: ClinicalRead, target: Resource{Kind: "patient", ID: patient}},
		{name: "clinician missing assignment adapter", actor: clinician, action: ClinicalRead, target: Resource{Kind: "patient", ID: patient}},
		{name: "unknown export policy", actor: administrator, action: "patient.export"},
		{name: "missing record target", actor: clinician, action: ClinicalRead},
	} {
		t.Run(tc.name, func(t *testing.T) {
			err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
				return (&Authorizer{}).Require(ctx, tx, tc.actor, tc.action, tc.target)
			})
			if !errors.Is(err, ErrForbidden) {
				t.Fatalf("expected fail-closed denial: %v", err)
			}
		})
	}
	if _, err := pool.Exec(ctx, `DELETE FROM staff_roles WHERE staff_id=$1`, receptionist); err != nil {
		t.Fatal(err)
	}
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error { return policy.CanRegister(ctx, tx, receptionist) })
	if !errors.Is(err, patients.ErrForbidden) {
		t.Fatalf("revoked role retained permission: %v", err)
	}
	if _, err := pool.Exec(ctx, `UPDATE staff_accounts SET active=false WHERE id=$1`, administrator); err != nil {
		t.Fatal(err)
	}
	err = pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		return (&Authorizer{Records: fixtureAssignment{actor: administrator, patient: patient}}).
			Require(ctx, tx, administrator, ClinicalRead, Resource{Kind: "patient", ID: patient})
	})
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("disabled account retained permission: %v", err)
	}
}

// A test-only assignment adapter proves the contract without inventing a module
// schema. Production clinical/session routes remain unregistered until their
// owners supply real assignment and transition checks in the business transaction.
type fixtureAssignment struct {
	actor, patient string
}

func (f fixtureAssignment) AuthorizeRecord(_ context.Context, _ pgx.Tx, actor string, _ Action, target Resource) error {
	if actor != f.actor || target.Kind != "patient" || target.ID != f.patient {
		return ErrForbidden
	}
	return nil
}
