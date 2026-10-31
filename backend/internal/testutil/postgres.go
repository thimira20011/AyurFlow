//go:build integration

// Package testutil provides isolated synthetic PostgreSQL fixtures for module tests.
package testutil

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"os"
	"testing"
	"time"

	"ayurflow/backend/db"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Postgres migrates an isolated schema in an explicitly configured disposable
// database. Legacy variable names remain supported for existing local workflows.
// Missing database configuration fails in CI and skips local integration tests.
func Postgres(t *testing.T, legacyVariables ...string) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	for _, name := range legacyVariables {
		if value := os.Getenv(name); value != "" {
			url = value
			break
		}
	}
	if url == "" {
		if os.Getenv("CI") != "" {
			t.Fatal("TEST_DATABASE_URL is required for PostgreSQL integration tests in CI")
		}
		t.Skip("TEST_DATABASE_URL is not set; requires a disposable PostgreSQL database")
	}
	ctx, cancel := context.WithTimeout(t.Context(), 30*time.Second)
	defer cancel()
	configuration, err := pgxpool.ParseConfig(url)
	if err != nil {
		t.Fatal("invalid test database configuration")
	}
	configuration.MaxConns = 4
	configuration.ConnConfig.ConnectTimeout = 5 * time.Second
	configuration.ConnConfig.RuntimeParams["timezone"] = "UTC"
	base, err := pgxpool.NewWithConfig(ctx, configuration)
	if err != nil {
		t.Fatal("create test database pool")
	}
	t.Cleanup(base.Close)
	// The real runner serializes extension setup and migrations across packages.
	if err := db.Migrate(ctx, base); err != nil {
		t.Fatalf("migrate test database: %v", err)
	}
	var suffix [12]byte
	if _, err := rand.Read(suffix[:]); err != nil {
		t.Fatal(err)
	}
	schema := pgx.Identifier{"test_" + hex.EncodeToString(suffix[:])}.Sanitize()
	if _, err := base.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		cleanup, stop := context.WithTimeout(context.Background(), 10*time.Second)
		defer stop()
		// The target is the random identifier generated above, never user input.
		if _, err := base.Exec(cleanup, "DROP SCHEMA "+schema+" CASCADE"); err != nil {
			t.Errorf("remove isolated test schema: %v", err)
		}
	})
	isolated := configuration.Copy()
	isolated.ConnConfig.RuntimeParams["search_path"] = schema
	pool, err := pgxpool.NewWithConfig(ctx, isolated)
	if err != nil {
		t.Fatal("create isolated test database pool")
	}
	t.Cleanup(pool.Close)
	if err := db.Migrate(ctx, pool); err != nil {
		t.Fatalf("migrate isolated test schema: %v", err)
	}
	return pool
}
