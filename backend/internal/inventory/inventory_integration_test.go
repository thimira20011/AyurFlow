//go:build integration

package inventory_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"ayurflow/backend/internal/audit"
	"ayurflow/backend/internal/inventory"
	"ayurflow/backend/internal/testutil"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func seedStaff(t *testing.T, pool *pgxpool.Pool, login string, roles ...string) string {
	t.Helper()
	var staffID string
	err := pool.QueryRow(t.Context(), `
		INSERT INTO staff_accounts (login_identifier, password_hash)
		VALUES ($1, '$argon2id$synthetic-test-only')
		RETURNING id::text`, login).Scan(&staffID)
	if err != nil {
		t.Fatalf("insert staff %s: %v", login, err)
	}
	for _, role := range roles {
		if _, err := pool.Exec(t.Context(), `
			INSERT INTO staff_roles (staff_id, role_code)
			VALUES ($1, $2)`, staffID, role); err != nil {
			t.Fatalf("insert role %s for %s: %v", role, login, err)
		}
	}
	return staffID
}

func TestAT08BotanicalItemsAndStockBatchesIntegration(t *testing.T) {
	pool := testutil.Postgres(t)
	ctx := t.Context()

	// Fixed clinic clock: 2026-10-31T08:30:00Z -> 2026-10-31 in Asia/Colombo.
	fixedNow := func() time.Time {
		return time.Date(2026, 10, 31, 8, 30, 0, 0, time.UTC)
	}
	svc := inventory.NewService(pool).WithClock(fixedNow)

	dispensaryID := seedStaff(t, pool, "synthetic-dispensary", "dispensary")
	adminID := seedStaff(t, pool, "synthetic-admin", "administrator")
	receptionID := seedStaff(t, pool, "synthetic-reception", "receptionist")
	reportReaderID := seedStaff(t, pool, "synthetic-reporter", "report_reader")

	// 1. Role enforcement: receptionist cannot create botanical items or receive batches.
	if _, err := svc.CreateItem(ctx, receptionID, inventory.CreateItemRequest{
		Code:        "BOT-DENIED-001",
		DisplayName: "Denied Item",
	}); !errors.Is(err, inventory.ErrForbidden) {
		t.Fatalf("receptionist CreateItem err = %v, want ErrForbidden", err)
	}

	// 2. Create botanical item as dispensary (INV-01) and verify transactional audit event.
	ashwa, err := svc.CreateItem(ctx, dispensaryID, inventory.CreateItemRequest{
		Code:        "bot-ashwa-001",
		DisplayName: "Ashwagandha Root (Withania somnifera) · අශ්වගන්ධා",
	})
	if err != nil {
		t.Fatalf("CreateItem failed: %v", err)
	}
	if ashwa.Code != "BOT-ASHWA-001" || ashwa.BaseUnit != "g" || !ashwa.Active {
		t.Fatalf("unexpected item state: %+v", ashwa)
	}

	// Duplicate item code returns ErrConflict.
	if _, err := svc.CreateItem(ctx, dispensaryID, inventory.CreateItemRequest{
		Code:        "BOT-ASHWA-001",
		DisplayName: "Duplicate Ashwagandha",
	}); !errors.Is(err, inventory.ErrConflict) {
		t.Fatalf("duplicate CreateItem err = %v, want ErrConflict", err)
	}

	// Administrator alone cannot receive a stock batch (dispensary only).
	futureExpiry := "2027-06-30"
	if _, err := svc.ReceiveBatch(ctx, adminID, inventory.ReceiveBatchRequest{
		ItemID:         ashwa.ID,
		BatchReference: "CLN-BATCH-ADMIN-DENIED",
		ReceivedGrams:  "500.000",
		ExpiresAt:      &futureExpiry,
	}); !errors.Is(err, inventory.ErrForbidden) {
		t.Fatalf("admin ReceiveBatch err = %v, want ErrForbidden", err)
	}

	// 3. Receive 4 batches matching AT08 synthetic fixtures:
	//    - Batch A01: 1000.000 g, expires 2027-06-30 -> eligible
	//    - Batch A02:  500.000 g, expires 2027-03-31 -> eligible (will be blocked next)
	//    - Batch A03:  250.000 g, expires 2026-10-15 -> expired (before 2026-10-31 Colombo)
	//    - Batch A04:  200.000 g, expires nil        -> unknown_expiry (SRS §8 gate rule)
	expA01 := "2027-06-30"
	batchA01, err := svc.ReceiveBatch(ctx, dispensaryID, inventory.ReceiveBatchRequest{
		ItemID:         ashwa.ID,
		BatchReference: "CLN-BATCH-2026-A01",
		ReceivedGrams:  "1000.000",
		ExpiresAt:      &expA01,
	})
	if err != nil {
		t.Fatalf("ReceiveBatch A01 failed: %v", err)
	}
	if batchA01.Eligibility != inventory.EligibilityEligible || batchA01.RemainingGrams != "1000.000" {
		t.Fatalf("unexpected A01 state: %+v", batchA01)
	}

	expA02 := "2027-03-31"
	batchA02, err := svc.ReceiveBatch(ctx, dispensaryID, inventory.ReceiveBatchRequest{
		ItemID:         ashwa.ID,
		BatchReference: "CLN-BATCH-2026-A02",
		ReceivedGrams:  "500",
		ExpiresAt:      &expA02,
	})
	if err != nil {
		t.Fatalf("ReceiveBatch A02 failed: %v", err)
	}
	if batchA02.ReceivedGrams != "500.000" || batchA02.Eligibility != inventory.EligibilityEligible {
		t.Fatalf("unexpected A02 state: %+v", batchA02)
	}

	expA03 := "2026-10-15"
	batchA03, err := svc.ReceiveBatch(ctx, dispensaryID, inventory.ReceiveBatchRequest{
		ItemID:         ashwa.ID,
		BatchReference: "CLN-BATCH-2026-A03-EXP",
		ReceivedGrams:  "250.000",
		ExpiresAt:      &expA03,
	})
	if err != nil {
		t.Fatalf("ReceiveBatch A03 failed: %v", err)
	}
	if batchA03.Eligibility != inventory.EligibilityExpired {
		t.Fatalf("A03 eligibility = %q, want %q", batchA03.Eligibility, inventory.EligibilityExpired)
	}

	batchA04, err := svc.ReceiveBatch(ctx, dispensaryID, inventory.ReceiveBatchRequest{
		ItemID:         ashwa.ID,
		BatchReference: "CLN-BATCH-2026-A04-UNK",
		ReceivedGrams:  "200.000",
		ExpiresAt:      nil,
	})
	if err != nil {
		t.Fatalf("ReceiveBatch A04 failed: %v", err)
	}
	if batchA04.Eligibility != inventory.EligibilityUnknownExpiry {
		t.Fatalf("A04 eligibility = %q, want %q", batchA04.Eligibility, inventory.EligibilityUnknownExpiry)
	}

	// 4. Blocking batch A02 requires a nonblank reason (INV-02).
	if _, err := svc.BlockBatch(ctx, dispensaryID, batchA02.ID, inventory.BlockBatchRequest{
		Reason: "   ",
	}); !errors.Is(err, inventory.ErrValidation) {
		t.Fatalf("blank BlockBatch reason err = %v, want ErrValidation", err)
	}

	blockedA02, err := svc.BlockBatch(ctx, dispensaryID, batchA02.ID, inventory.BlockBatchRequest{
		Reason: "Packaging seal damaged during transit",
	})
	if err != nil {
		t.Fatalf("BlockBatch A02 failed: %v", err)
	}
	if !blockedA02.Blocked || blockedA02.Eligibility != inventory.EligibilityBlocked || blockedA02.BlockReason == nil || *blockedA02.BlockReason != "Packaging seal damaged during transit" {
		t.Fatalf("unexpected blocked A02 state: %+v", blockedA02)
	}

	// Repeat block returns ErrConflict.
	if _, err := svc.BlockBatch(ctx, dispensaryID, batchA02.ID, inventory.BlockBatchRequest{
		Reason: "Second block attempt",
	}); !errors.Is(err, inventory.ErrConflict) {
		t.Fatalf("repeat BlockBatch err = %v, want ErrConflict", err)
	}

	// 5. Verify ListBatches summary totals and eligibleOnly filter (INV-02, INV-03).
	allPage, err := svc.ListBatches(ctx, reportReaderID, inventory.ListBatchesFilter{ItemID: ashwa.ID})
	if err != nil {
		t.Fatalf("ListBatches(all) failed: %v", err)
	}
	if len(allPage.Items) != 4 {
		t.Fatalf("ListBatches(all) count = %d, want 4", len(allPage.Items))
	}
	if allPage.Summary.EligibleGrams != "1000.000" ||
		allPage.Summary.BlockedGrams != "500.000" ||
		allPage.Summary.ExpiredGrams != "250.000" ||
		allPage.Summary.UnknownExpiryGrams != "200.000" {
		t.Fatalf("unexpected summary totals: %+v", allPage.Summary)
	}

	eligiblePage, err := svc.ListBatches(ctx, dispensaryID, inventory.ListBatchesFilter{
		ItemID:       ashwa.ID,
		EligibleOnly: true,
	})
	if err != nil {
		t.Fatalf("ListBatches(eligibleOnly) failed: %v", err)
	}
	if len(eligiblePage.Items) != 1 || eligiblePage.Items[0].ID != batchA01.ID {
		t.Fatalf("ListBatches(eligibleOnly) = %+v, want only batch A01", eligiblePage.Items)
	}

	// 6. Deactivate item (ADM-01): prevents new batch receipts while retaining historical batch references.
	deactivated, err := svc.DeactivateItem(ctx, adminID, ashwa.ID, inventory.DeactivateItemRequest{
		Reason: "Replaced by standardized extract catalog entry",
	})
	if err != nil {
		t.Fatalf("DeactivateItem failed: %v", err)
	}
	if deactivated.Active {
		t.Fatalf("expected item to be inactive after DeactivateItem")
	}

	if _, err := svc.ReceiveBatch(ctx, dispensaryID, inventory.ReceiveBatchRequest{
		ItemID:         ashwa.ID,
		BatchReference: "CLN-BATCH-AFTER-DEACTIVATE",
		ReceivedGrams:  "100.000",
		ExpiresAt:      &expA01,
	}); !errors.Is(err, inventory.ErrConflict) {
		t.Fatalf("ReceiveBatch on deactivated item err = %v, want ErrConflict", err)
	}

	// Historical batches still retain and return the deactivated item's code and display name.
	retainedPage, err := svc.ListBatches(ctx, dispensaryID, inventory.ListBatchesFilter{ItemID: ashwa.ID})
	if err != nil {
		t.Fatalf("ListBatches after item deactivation failed: %v", err)
	}
	if len(retainedPage.Items) != 4 || retainedPage.Items[0].ItemCode != "BOT-ASHWA-001" {
		t.Fatalf("historical batches did not retain item reference: %+v", retainedPage.Items)
	}

	// 7. Verify audit failure rolls back business mutation (AUD-01–02).
	failingSvc := inventory.NewService(pool).WithClock(fixedNow).WithAuditWriter(func(ctx context.Context, tx pgx.Tx, event audit.Event) error {
		return errors.New("forced audit failure")
	})
	if _, err := failingSvc.CreateItem(ctx, dispensaryID, inventory.CreateItemRequest{
		Code:        "BOT-ROLLBACK-001",
		DisplayName: "Must Roll Back On Audit Failure",
	}); err == nil {
		t.Fatalf("expected CreateItem to fail when audit writer fails")
	}
	var count int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM botanical_items WHERE code = 'BOT-ROLLBACK-001'`).Scan(&count); err != nil {
		t.Fatalf("query rolled-back item count: %v", err)
	}
	if count != 0 {
		t.Fatalf("rolled-back item count = %d, want 0", count)
	}

	// 8. Verify audit_events rows were committed for the successful operations.
	var auditCount int
	if err := pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM audit_events
		WHERE action IN ('botanical_item.created', 'botanical_item.deactivated', 'stock_batch.received', 'stock_batch.blocked')`).Scan(&auditCount); err != nil {
		t.Fatalf("query audit_events count: %v", err)
	}
	// 1 created + 4 received + 1 blocked + 1 deactivated = 7 events
	if auditCount != 7 {
		t.Fatalf("audit_events count = %d, want 7", auditCount)
	}
}
