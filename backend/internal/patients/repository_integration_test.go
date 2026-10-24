//go:build integration

package patients

import (
	"context"
	"errors"
	"testing"
	"time"

	"ayurflow/backend/internal/testutil"

	"github.com/jackc/pgx/v5"
)

func TestReadPatientCommittedSnapshotIntegration(t *testing.T) {
	pool := testutil.Postgres(t)
	ctx, cancel := context.WithTimeout(t.Context(), 15*time.Second)
	defer cancel()
	var actor string
	err := pool.QueryRow(ctx, `INSERT INTO staff_accounts(login_identifier, password_hash)
		VALUES ('synthetic-patient-snapshot', '$argon2id$synthetic-fixture') RETURNING id::text`).Scan(&actor)
	if err != nil {
		t.Fatal(err)
	}
	service := NewService(pool, &testAccess{})
	before, err := service.Create(ctx, actor, RegistrationInput{
		DisplayName: "Synthetic before",
		Identity:    &IdentityInput{Type: "NIC", Value: "before-identity"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if before.Identity == nil {
		t.Fatal("snapshot fixture has no identity")
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(ctx)
	changed := false
	interleaved := &afterFirstScanTx{
		Tx: tx,
		afterScan: func() error {
			name := "Synthetic after"
			_, err := service.Update(ctx, actor, before.ID, UpdateInput{
				Version:     before.Version,
				DisplayName: &name,
				Identity: OptionalIdentity{
					Set: true, Value: &IdentityInput{Type: "PASSPORT", Value: "after-identity"},
				},
			})
			changed = err == nil
			return err
		},
	}
	observed, err := readPatient(ctx, interleaved, before.ID)
	if err != nil {
		t.Fatal(err)
	}
	if !changed {
		t.Fatal("concurrent audited update did not commit during the read")
	}
	sameDemographics := observed.Version == before.Version && observed.DisplayName == before.DisplayName
	sameIdentity := observed.Identity != nil && *observed.Identity == *before.Identity
	if !sameDemographics || !sameIdentity {
		t.Fatalf("read combined patient versions: %+v", observed)
	}
	after, err := service.Get(ctx, actor, before.ID)
	if err != nil {
		t.Fatal(err)
	}
	updatedDemographics := after.Version == 2 && after.DisplayName == "Synthetic after"
	updatedIdentity := after.Identity != nil &&
		*after.Identity == (IdentityInput{Type: "PASSPORT", Value: "after-identity"})
	if !updatedDemographics || !updatedIdentity {
		t.Fatalf("concurrent update was not preserved: patient=%+v", after)
	}
}

func TestReadPatientNullableIdentityIntegration(t *testing.T) {
	pool := testutil.Postgres(t)
	ctx, cancel := context.WithTimeout(t.Context(), 15*time.Second)
	defer cancel()
	var actor string
	err := pool.QueryRow(ctx, `INSERT INTO staff_accounts(login_identifier, password_hash)
		VALUES ('synthetic-nullable-patient', '$argon2id$synthetic-fixture') RETURNING id::text`).Scan(&actor)
	if err != nil {
		t.Fatal(err)
	}
	service := NewService(pool, &testAccess{})
	for _, tc := range []struct {
		name     string
		identity *IdentityInput
	}{
		{name: "absent identity"},
		{name: "cleared identity", identity: &IdentityInput{Type: "NIC", Value: "synthetic-clear"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			created, err := service.Create(ctx, actor, RegistrationInput{
				DisplayName: "Synthetic nullable", Identity: tc.identity,
			})
			if err != nil {
				t.Fatal(err)
			}
			if tc.identity != nil {
				_, err = service.Update(ctx, actor, created.ID, UpdateInput{
					Version: created.Version, Identity: OptionalIdentity{Set: true},
				})
				if err != nil {
					t.Fatal(err)
				}
			}
			current, err := service.Get(ctx, actor, created.ID)
			if err != nil {
				t.Fatal(err)
			}
			if current.Identity != nil || current.Phone != nil {
				t.Fatalf("nullable values changed: patient=%+v", current)
			}
		})
	}
	_, err = service.Get(ctx, actor, "00000000-0000-4000-8000-000000000001")
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("missing patient returned %v", err)
	}
}

// The wrapper commits a real update after Scan releases the first statement's
// snapshot, deterministically exercising the gap between two separate SELECTs.
type afterFirstScanTx struct {
	pgx.Tx
	afterScan func() error
}

func (tx *afterFirstScanTx) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	row := tx.Tx.QueryRow(ctx, sql, args...)
	callback := tx.afterScan
	tx.afterScan = nil
	return afterScanRow{Row: row, afterScan: callback}
}

type afterScanRow struct {
	pgx.Row
	afterScan func() error
}

func (row afterScanRow) Scan(dest ...any) error {
	if err := row.Row.Scan(dest...); err != nil {
		return err
	}
	if row.afterScan != nil {
		return row.afterScan()
	}
	return nil
}
