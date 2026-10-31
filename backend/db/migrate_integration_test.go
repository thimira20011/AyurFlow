//go:build integration

package db_test

import (
	"testing"

	"ayurflow/backend/db"
	"ayurflow/backend/internal/testutil"
)

func TestMigrateFreshDatabaseAndRepeatIntegration(t *testing.T) {
	pool := testutil.Postgres(t)
	var before int
	if err := pool.QueryRow(t.Context(), `SELECT count(*) FROM schema_migrations`).Scan(&before); err != nil {
		t.Fatal(err)
	}
	if before == 0 {
		t.Fatal("fresh schema has no applied migrations")
	}
	_, err := pool.Exec(t.Context(), `INSERT INTO staff_accounts(login_identifier, password_hash)
		VALUES ('synthetic-migration-test', '$argon2id$synthetic-non-login-fixture')`)
	if err != nil {
		t.Fatal(err)
	}
	if err := db.Migrate(t.Context(), pool); err != nil {
		t.Fatalf("repeat migration: %v", err)
	}
	var after, staff int
	if err := pool.QueryRow(t.Context(), `SELECT count(*) FROM schema_migrations`).Scan(&after); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(t.Context(), `SELECT count(*) FROM staff_accounts`).Scan(&staff); err != nil {
		t.Fatal(err)
	}
	if after != before || staff != 1 {
		t.Fatal("repeat migration changed applied versions or synthetic committed data")
	}
}

func TestPostgresFixturesAreIsolatedIntegration(t *testing.T) {
	first := testutil.Postgres(t)
	second := testutil.Postgres(t)
	_, err := first.Exec(t.Context(), `INSERT INTO staff_accounts(login_identifier, password_hash)
		VALUES ('synthetic-isolation-test', '$argon2id$synthetic-non-login-fixture')`)
	if err != nil {
		t.Fatal(err)
	}
	var count int
	if err := second.QueryRow(t.Context(), `SELECT count(*) FROM staff_accounts`).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Fatal("one module's fixture leaked records into another fixture")
	}
}
