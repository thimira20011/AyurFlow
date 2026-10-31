//go:build integration

package patients

import (
	"context"
	"testing"
	"time"

	"ayurflow/backend/internal/testutil"
)

// This proves that the database, not application prechecks, enforces identity
// uniqueness and allows patients who have no supplied identity.
func TestPatientSchemaIntegration(t *testing.T) {
	pool := testutil.Postgres(t)
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(ctx)
	var actor string
	err = tx.QueryRow(ctx, `INSERT INTO staff_accounts(login_identifier, password_hash)
		VALUES ($1, '$argon2id$synthetic-test-only') RETURNING id::text`,
		"patient-schema-"+time.Now().UTC().Format("20060102150405.000000000")).Scan(&actor)
	if err != nil {
		t.Fatal(err)
	}
	insertPatient := func(name string) string {
		t.Helper()
		var id string
		err := tx.QueryRow(ctx, `INSERT INTO patients(display_name, created_by, updated_by)
			VALUES ($1, $2, $2) RETURNING id::text`, name, actor).Scan(&id)
		if err != nil {
			t.Fatal(err)
		}
		return id
	}
	first := insertPatient("සිංහල රෝගියා")
	second := insertPatient("Synthetic Patient")
	insertPatient("No supplied identity")

	var canonical string
	err = tx.QueryRow(ctx, `INSERT INTO patient_identities(patient_id, identity_type, original_value)
		VALUES ($1, 'NIC', '1999 12345678 V') RETURNING canonical_value`, first).Scan(&canonical)
	if err != nil || canonical != "199912345678V" {
		t.Fatalf("canonical value %q: %v", canonical, err)
	}
	result, err := tx.Exec(ctx, `INSERT INTO patient_identities(patient_id, identity_type, original_value)
		VALUES ($1, 'NIC', '1999-12345678v') ON CONFLICT DO NOTHING`, second)
	if err != nil || result.RowsAffected() != 0 {
		t.Fatalf("duplicate NIC accepted: rows=%d, err=%v", result.RowsAffected(), err)
	}
	if _, err := tx.Exec(ctx, `INSERT INTO patient_identities(patient_id, identity_type, original_value)
		VALUES ($1, 'PASSPORT', '1999-12345678v')`, second); err != nil {
		t.Fatalf("different identity type should be distinct: %v", err)
	}
	var name string
	if err := tx.QueryRow(ctx, `SELECT display_name FROM patients WHERE id=$1`, first).Scan(&name); err != nil || name != "සිංහල රෝගියා" {
		t.Fatalf("Unicode round trip %q: %v", name, err)
	}
}
