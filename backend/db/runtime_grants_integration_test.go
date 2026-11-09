//go:build integration

package db_test

import (
	"context"
	"errors"
	"os"
	"strings"
	"testing"
	"time"

	"ayurflow/backend/internal/testutil"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

func TestPilotRuntimePrivilegesIntegration(t *testing.T) {
	pool := testutil.Postgres(t)
	var schema string
	if err := pool.QueryRow(t.Context(), "SELECT current_schema()").Scan(&schema); err != nil {
		t.Fatal(err)
	}
	role := pgx.Identifier{"runtime_" + schema}.Sanitize()
	if _, err := pool.Exec(t.Context(), "CREATE ROLE "+role+" NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT"); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if _, err := pool.Exec(ctx, "DROP OWNED BY "+role+"; DROP ROLE "+role); err != nil {
			t.Error(err)
		}
	})
	contents, err := os.ReadFile("../../deploy/runtime-grants.sql")
	if err != nil {
		t.Fatal(err)
	}
	sql := strings.NewReplacer(`:"schema"`, pgx.Identifier{schema}.Sanitize(), `:"app_role"`, role).Replace(string(contents))
	if _, err := pool.Exec(t.Context(), sql); err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		name, sql string
		denied    bool
	}{
		{name: "read role catalog", sql: "SELECT code FROM roles"},
		{name: "write staff", sql: `INSERT INTO staff_accounts(login_identifier,password_hash)
			VALUES ('synthetic-runtime','$argon2id$synthetic-test-only')`},
		{name: "read patient", sql: "SELECT id FROM patients"},
		{name: "atomic staff and audit insert", sql: `WITH actor AS (
			INSERT INTO staff_accounts(login_identifier,password_hash)
			VALUES ('synthetic-audited-runtime','$argon2id$synthetic-test-only') RETURNING id)
			INSERT INTO audit_events(actor_id,action,object_type,object_id)
			SELECT id,'staff.created','staff',id::text FROM actor`},
		{name: "lock account", sql: "SELECT id FROM staff_accounts FOR SHARE"},
		{name: "create table", sql: "CREATE TABLE forbidden_runtime_table(id int)", denied: true},
		{name: "alter schema", sql: "ALTER TABLE staff_accounts ADD COLUMN forbidden int", denied: true},
		{name: "migration history", sql: "SELECT * FROM schema_migrations", denied: true},
		{name: "edit catalog", sql: "UPDATE roles SET name=name", denied: true},
		{name: "rewrite audit", sql: "UPDATE audit_events SET action='test.changed'", denied: true},
		{name: "delete audit", sql: "DELETE FROM audit_events", denied: true},
		{name: "truncate audit", sql: "TRUNCATE audit_events", denied: true},
		{name: "rewrite plan decision", sql: "UPDATE plan_decisions SET reason='changed'", denied: true},
		{name: "delete plan decision", sql: "DELETE FROM plan_decisions", denied: true},
		{name: "truncate plan decisions", sql: "TRUNCATE plan_decisions", denied: true},
		{name: "delete assignment", sql: "DELETE FROM patient_clinician_assignments", denied: true},
		{name: "delete plan", sql: "DELETE FROM care_plans", denied: true},
		{name: "delete stage", sql: "DELETE FROM plan_stages", denied: true},
		{name: "delete botanical item", sql: "DELETE FROM botanical_items", denied: true},
		{name: "delete stock batch", sql: "DELETE FROM stock_batches", denied: true},
		{name: "delete therapy session", sql: "DELETE FROM therapy_sessions", denied: true},
		{name: "delete consumption", sql: "DELETE FROM batch_consumptions", denied: true},
		{name: "rewrite preparation snapshot", sql: "UPDATE preparation_snapshot_items SET required_grams=1", denied: true},
		{name: "reset patient registry", sql: "ALTER SEQUENCE patient_registry_numbers RESTART", denied: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			tx, err := pool.Begin(t.Context())
			if err != nil {
				t.Fatal(err)
			}
			defer tx.Rollback(t.Context())
			if _, err := tx.Exec(t.Context(), "SET LOCAL ROLE "+role); err != nil {
				t.Fatal(err)
			}
			_, err = tx.Exec(t.Context(), tc.sql)
			if !tc.denied && err != nil {
				t.Fatal(err)
			}
			var databaseError *pgconn.PgError
			if tc.denied && (!errors.As(err, &databaseError) || databaseError.Code != "42501") {
				t.Fatalf("expected insufficient_privilege, got %v", err)
			}
		})
	}
	t.Run("clinical lifecycle with runtime credentials", func(t *testing.T) {
		tx, err := pool.Begin(t.Context())
		if err != nil {
			t.Fatal(err)
		}
		defer tx.Rollback(t.Context())
		if _, err := tx.Exec(t.Context(), "SET LOCAL ROLE "+role); err != nil {
			t.Fatal(err)
		}
		var actor, patient, plan, stage string
		if err := tx.QueryRow(t.Context(), `INSERT INTO staff_accounts(login_identifier,password_hash)
			VALUES ('synthetic-clinical-runtime','$argon2id$synthetic-test-only') RETURNING id::text`).Scan(&actor); err != nil {
			t.Fatal(err)
		}
		if err := tx.QueryRow(t.Context(), `INSERT INTO patients(display_name,created_by,updated_by)
			VALUES ('Synthetic runtime patient',$1,$1) RETURNING id::text`, actor).Scan(&patient); err != nil {
			t.Fatal(err)
		}
		if _, err := tx.Exec(t.Context(), `INSERT INTO patient_clinician_assignments(patient_id,clinician_id,granted_by)
			VALUES ($1,$2,$2)`, patient, actor); err != nil {
			t.Fatal(err)
		}
		if err := tx.QueryRow(t.Context(), `INSERT INTO care_plans(patient_id,created_by,updated_by)
			VALUES ($1,$2,$2) RETURNING id::text`, patient, actor).Scan(&plan); err != nil {
			t.Fatal(err)
		}
		if err := tx.QueryRow(t.Context(), `INSERT INTO plan_stages(plan_id,ordinal,stage_code,label)
			VALUES ($1,1,'PREPARATORY','Synthetic preparatory stage') RETURNING id::text`, plan).Scan(&stage); err != nil {
			t.Fatal(err)
		}
		for _, query := range []string{
			`SELECT id FROM patient_clinician_assignments WHERE clinician_id=$1::uuid FOR SHARE`,
			`UPDATE patient_clinician_assignments SET revoked_at=clock_timestamp(),revoked_by=$1::uuid RETURNING id`,
			`UPDATE plan_stages SET status='approved',approved_by=$1::uuid,approved_at=clock_timestamp() RETURNING id`,
			`UPDATE care_plans SET status='active',current_stage_ordinal=1,updated_by=$1::uuid RETURNING id`,
		} {
			var id string
			if err := tx.QueryRow(t.Context(), query, actor).Scan(&id); err != nil {
				t.Fatal(err)
			}
		}
		var decision string
		if err := tx.QueryRow(t.Context(), `WITH decision AS (
			INSERT INTO plan_decisions(plan_id,stage_id,action,actor_id,from_status,to_status)
			VALUES ($1,$2,'start',$3,'draft','active') RETURNING id)
			INSERT INTO audit_events(actor_id,action,object_type,object_id)
			SELECT $3,'plan.started','plan',$1::uuid::text FROM decision RETURNING object_id`, plan, stage, actor).Scan(&decision); err != nil {
			t.Fatal(err)
		}
		if decision != plan {
			t.Fatalf("audited plan = %q, want %q", decision, plan)
		}
		if err := tx.QueryRow(t.Context(), "SELECT plan_id::text FROM plan_decisions").Scan(&decision); err != nil {
			t.Fatal(err)
		}
		if decision != plan {
			t.Fatalf("decision plan = %q, want %q", decision, plan)
		}
		if _, err := tx.Exec(t.Context(), "SET CONSTRAINTS ALL IMMEDIATE"); err != nil {
			t.Fatal(err)
		}
	})
}
