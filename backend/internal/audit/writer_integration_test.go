//go:build integration

package audit

import (
	"context"
	"errors"
	"testing"
	"time"

	"ayurflow/backend/internal/testutil"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

func auditTestDatabase(t *testing.T) *pgxpool.Pool {
	t.Helper()
	pool := testutil.Postgres(t, "AUDIT_TEST_DATABASE_URL")
	_, err := pool.Exec(
		t.Context(),
		`INSERT INTO staff_accounts(id, login_identifier, password_hash)
		 VALUES ($1, 'synthetic-audit-actor', '$argon2id$synthetic-non-login-fixture')`,
		syntheticActor,
	)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(t.Context(), `CREATE TABLE audit_test_mutations(id text PRIMARY KEY)`); err != nil {
		t.Fatal(err)
	}
	return pool
}

func beginAuditMutation(t *testing.T, pool *pgxpool.Pool, id string) pgx.Tx {
	t.Helper()
	tx, err := pool.Begin(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		cleanup, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := tx.Rollback(cleanup); err != nil && !errors.Is(err, pgx.ErrTxClosed) {
			t.Errorf("rollback test transaction: %v", err)
		}
	})
	if _, err := tx.Exec(t.Context(), `INSERT INTO audit_test_mutations(id) VALUES ($1)`, id); err != nil {
		t.Fatal(err)
	}
	return tx
}

func assertMutationAbsent(t *testing.T, pool *pgxpool.Pool, id string) {
	t.Helper()
	var count int
	err := pool.QueryRow(t.Context(), `SELECT count(*) FROM audit_test_mutations WHERE id=$1`, id).Scan(&count)
	if err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Fatalf("mutation %q survived an aborted audit transaction", id)
	}
}

func TestWriteAtomicityIntegration(t *testing.T) {
	pool := auditTestDatabase(t)
	t.Run("business and audit commit together", func(t *testing.T) {
		tx := beginAuditMutation(t, pool, "committed")
		if err := Write(t.Context(), tx, validEvent()); err != nil {
			t.Fatal(err)
		}
		// A different connection cannot see either uncommitted write.
		var count int
		if err := pool.QueryRow(t.Context(), `SELECT count(*) FROM audit_events`).Scan(&count); err != nil {
			t.Fatal(err)
		}
		if count != 0 {
			t.Fatal("audit escaped the business transaction")
		}
		if err := tx.Commit(t.Context()); err != nil {
			t.Fatal(err)
		}
		err := pool.QueryRow(t.Context(),
			`SELECT count(*) FROM audit_test_mutations WHERE id='committed'`).Scan(&count)
		if err != nil {
			t.Fatal(err)
		}
		if count != 1 {
			t.Fatal("business mutation did not commit with audit")
		}
		var actor, action, objectID, reason string
		var fields []string
		var at time.Time
		err = pool.QueryRow(t.Context(), `SELECT actor_id::text, action, object_id, reason,
			changed_fields, occurred_at FROM audit_events`).Scan(
			&actor,
			&action,
			&objectID,
			&reason,
			&fields,
			&at,
		)
		if err != nil {
			t.Fatal(err)
		}
		event := validEvent()
		metadataMatches := actor == event.ActorID && action == event.Action && objectID == event.Object.ID
		if !metadataMatches || reason != event.ReasonCode || len(fields) != 1 || fields[0] != "phone" || at.IsZero() {
			t.Fatal("committed audit metadata is incomplete")
		}
	})
	t.Run("storage failure rolls back business", func(t *testing.T) {
		tx := beginAuditMutation(t, pool, "storage-failure")
		_, err := tx.Exec(t.Context(), `CREATE FUNCTION force_audit_test_failure() RETURNS trigger
			LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic audit insert failure'; END; $$;
			CREATE TRIGGER force_audit_test_failure BEFORE INSERT ON audit_events
			FOR EACH ROW EXECUTE FUNCTION force_audit_test_failure()`)
		if err != nil {
			t.Fatal(err)
		}
		if err := Write(t.Context(), tx, validEvent()); err == nil {
			t.Fatal("forced audit failure was ignored")
		}
		if err := tx.Commit(t.Context()); !errors.Is(err, pgx.ErrTxClosed) {
			t.Fatalf("failed audit left a committable transaction: %v", err)
		}
		assertMutationAbsent(t, pool, "storage-failure")
	})
	t.Run("validation failure rolls back business", func(t *testing.T) {
		tx := beginAuditMutation(t, pool, "validation-failure")
		if err := Write(t.Context(), tx, Event{}); !errors.Is(err, ErrInvalidEvent) {
			t.Fatalf("invalid audit: %v", err)
		}
		if err := tx.Commit(t.Context()); !errors.Is(err, pgx.ErrTxClosed) {
			t.Fatalf("invalid audit left a committable transaction: %v", err)
		}
		assertMutationAbsent(t, pool, "validation-failure")
	})
	t.Run("later business rollback removes audit", func(t *testing.T) {
		var before int
		if err := pool.QueryRow(t.Context(), `SELECT count(*) FROM audit_events`).Scan(&before); err != nil {
			t.Fatal(err)
		}
		tx := beginAuditMutation(t, pool, "business-failure")
		if err := Write(t.Context(), tx, validEvent()); err != nil {
			t.Fatal(err)
		}
		if err := tx.Rollback(t.Context()); err != nil {
			t.Fatal(err)
		}
		assertMutationAbsent(t, pool, "business-failure")
		var count int
		if err := pool.QueryRow(t.Context(), `SELECT count(*) FROM audit_events`).Scan(&count); err != nil {
			t.Fatal(err)
		}
		if count != before {
			t.Fatalf("rolled back audit survived: total=%d", count)
		}
	})
}

func TestAuditImmutabilityIntegration(t *testing.T) {
	pool := auditTestDatabase(t)
	tx := beginAuditMutation(t, pool, "immutable")
	if err := Write(t.Context(), tx, validEvent()); err != nil {
		t.Fatal(err)
	}
	if err := tx.Commit(t.Context()); err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		name string
		sql  string
	}{
		{name: "update", sql: `UPDATE audit_events SET reason='altered'`},
		{name: "delete", sql: `DELETE FROM audit_events`},
		{name: "truncate", sql: `TRUNCATE audit_events`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, err := pool.Exec(t.Context(), tc.sql)
			var postgresError *pgconn.PgError
			if !errors.As(err, &postgresError) || postgresError.Code != "55000" {
				t.Fatalf("audit mutation was not rejected by append-only protection: %v", err)
			}
		})
	}
	var reason string
	if err := pool.QueryRow(t.Context(), `SELECT reason FROM audit_events`).Scan(&reason); err != nil {
		t.Fatal(err)
	}
	if reason != validEvent().ReasonCode {
		t.Fatal("audit history changed")
	}
}

func TestAuditMetadataConstraintsIntegration(t *testing.T) {
	pool := auditTestDatabase(t)
	for _, tc := range []struct {
		name   string
		reason string
		fields []string
	}{
		{name: "free text reason", reason: "Synthetic clinical note body", fields: []string{}},
		{name: "free text field", reason: "correction", fields: []string{"Synthetic patient details"}},
		{name: "empty field", reason: "correction", fields: []string{""}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, err := pool.Exec(
				t.Context(),
				`INSERT INTO audit_events(actor_id, action, object_type, object_id, reason, changed_fields)
				 VALUES ($1, 'patient.updated', 'patient', 'synthetic-record', $2, $3)`,
				syntheticActor,
				tc.reason,
				tc.fields,
			)
			var postgresError *pgconn.PgError
			if !errors.As(err, &postgresError) || postgresError.Code != "23514" {
				t.Fatalf("database accepted unstructured audit metadata: %v", err)
			}
		})
	}
}
