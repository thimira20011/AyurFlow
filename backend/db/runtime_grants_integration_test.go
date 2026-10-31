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
}
