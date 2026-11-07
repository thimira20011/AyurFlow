package inventory

import (
	"context"
	"errors"
	"fmt"
	"time"

	"ayurflow/backend/internal/audit"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// AuditWriter abstracts transactional audit writing so tests can force audit failures
// and verify that the entire business transaction rolls back (SRS AUD-01–02).
type AuditWriter func(ctx context.Context, tx pgx.Tx, event audit.Event) error

// Service enforces backend role authorization, fixed-precision gram invariants,
// Asia/Colombo expiry rules, and transactional audit logging for botanical items
// and stock batches (TASK-INV-01).
type Service struct {
	pool       *pgxpool.Pool
	repo       *Repository
	now        func() time.Time
	writeAudit AuditWriter
}

// NewService creates an inventory Service backed by the given pgxpool.Pool.
func NewService(pool *pgxpool.Pool) *Service {
	return &Service{
		pool:       pool,
		repo:       NewRepository(pool),
		now:        time.Now,
		writeAudit: audit.Write,
	}
}

// WithClock overrides the clock used for Asia/Colombo expiry date evaluation (used in tests).
func (s *Service) WithClock(now func() time.Time) *Service {
	s.now = now
	return s
}

// WithAuditWriter overrides the transactional audit writer (used in tests to prove rollback on audit failure).
func (s *Service) WithAuditWriter(writer AuditWriter) *Service {
	if writer != nil {
		s.writeAudit = writer
	}
	return s
}

// CreateItem registers a new botanical catalog item in grams (SRS INV-01).
// Permitted roles: dispensary, administrator.
func (s *Service) CreateItem(ctx context.Context, actorID string, req CreateItemRequest) (BotanicalItem, error) {
	code, err := validateItemCode(req.Code)
	if err != nil {
		return BotanicalItem{}, err
	}
	displayName, err := validateDisplayName(req.DisplayName)
	if err != nil {
		return BotanicalItem{}, err
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return BotanicalItem{}, err
	}
	defer tx.Rollback(ctx)

	canonicalActor, err := s.requireRole(ctx, tx, actorID, "dispensary", "administrator")
	if err != nil {
		return BotanicalItem{}, err
	}

	item, err := s.repo.InsertItem(ctx, tx, code, displayName, canonicalActor)
	if err != nil {
		return BotanicalItem{}, err
	}

	if err := s.writeAudit(ctx, tx, audit.Event{
		ActorID: canonicalActor,
		Action:  "botanical_item.created",
		Object:  audit.Object{Type: "botanical_item", ID: item.ID},
	}); err != nil {
		_ = tx.Rollback(ctx)
		return BotanicalItem{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return BotanicalItem{}, err
	}
	return item, nil
}

// DeactivateItem deactivates a botanical item with a mandatory reason so it cannot be used
// in new batch receipts or recipes while preserving existing historical references (SRS ADM-01).
// Permitted roles: dispensary, administrator.
func (s *Service) DeactivateItem(ctx context.Context, actorID, itemID string, req DeactivateItemRequest) (BotanicalItem, error) {
	canonicalItemID, err := canonicalUUID(itemID, "itemId")
	if err != nil {
		return BotanicalItem{}, err
	}
	reason, err := validateReason(req.Reason, "reason")
	if err != nil {
		return BotanicalItem{}, err
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return BotanicalItem{}, err
	}
	defer tx.Rollback(ctx)

	canonicalActor, err := s.requireRole(ctx, tx, actorID, "dispensary", "administrator")
	if err != nil {
		return BotanicalItem{}, err
	}

	existing, err := s.repo.GetItemForUpdate(ctx, tx, canonicalItemID)
	if err != nil {
		return BotanicalItem{}, err
	}
	if !existing.Active {
		return BotanicalItem{}, fmt.Errorf("%w: botanical item is already deactivated", ErrConflict)
	}

	updated, err := s.repo.DeactivateItem(ctx, tx, canonicalItemID, reason, canonicalActor)
	if err != nil {
		return BotanicalItem{}, err
	}

	if err := s.writeAudit(ctx, tx, audit.Event{
		ActorID:       canonicalActor,
		Action:        "botanical_item.deactivated",
		Object:        audit.Object{Type: "botanical_item", ID: updated.ID},
		ReasonCode:    "catalog_deactivation",
		ChangedFields: []string{"active", "deactivated_reason"},
	}); err != nil {
		_ = tx.Rollback(ctx)
		return BotanicalItem{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return BotanicalItem{}, err
	}
	return updated, nil
}

// ListItems lists botanical items with bounded pagination.
// Permitted roles: dispensary, administrator, report_reader, clinician.
func (s *Service) ListItems(ctx context.Context, actorID string, activeOnly bool, limit int, cursor string) (BotanicalItemPage, error) {
	limit = normalizeLimit(limit)
	var canonicalCursor string
	if cursor != "" {
		var err error
		canonicalCursor, err = canonicalUUID(cursor, "cursor")
		if err != nil {
			return BotanicalItemPage{}, err
		}
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return BotanicalItemPage{}, err
	}
	defer tx.Rollback(ctx)

	if _, err := s.requireRole(ctx, tx, actorID, "dispensary", "administrator", "report_reader", "clinician"); err != nil {
		return BotanicalItemPage{}, err
	}

	rows, err := s.repo.ListItems(ctx, tx, activeOnly, limit+1, canonicalCursor)
	if err != nil {
		return BotanicalItemPage{}, err
	}
	_ = tx.Commit(ctx)

	var nextCursor *string
	if len(rows) > limit {
		last := rows[limit-1].ID
		nextCursor = &last
		rows = rows[:limit]
	}
	return BotanicalItemPage{
		Items:      rows,
		NextCursor: nextCursor,
	}, nil
}

// ReceiveBatch records a new botanical batch receipt in fixed-precision grams (SRS INV-01).
// Permitted role: dispensary only (administrator alone cannot receive or mutate stock batches).
func (s *Service) ReceiveBatch(ctx context.Context, actorID string, req ReceiveBatchRequest) (StockBatch, error) {
	canonicalItemID, err := canonicalUUID(req.ItemID, "itemId")
	if err != nil {
		return StockBatch{}, err
	}
	batchRef, err := validateBatchReference(req.BatchReference)
	if err != nil {
		return StockBatch{}, err
	}
	receivedMg, err := ParseGramsToMilligrams(req.ReceivedGrams, false)
	if err != nil {
		return StockBatch{}, err
	}
	canonicalGrams := FormatMilligramsToGrams(receivedMg)

	var validatedExpiry *string
	if req.ExpiresAt != nil {
		exp, err := ValidateISODate(*req.ExpiresAt)
		if err != nil {
			return StockBatch{}, err
		}
		validatedExpiry = &exp
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return StockBatch{}, err
	}
	defer tx.Rollback(ctx)

	canonicalActor, err := s.requireRole(ctx, tx, actorID, "dispensary")
	if err != nil {
		return StockBatch{}, err
	}

	item, err := s.repo.GetItemForShare(ctx, tx, canonicalItemID)
	if err != nil {
		return StockBatch{}, err
	}
	if !item.Active {
		return StockBatch{}, fmt.Errorf("%w: cannot receive batch for a deactivated botanical item", ErrConflict)
	}

	colomboDate := ColomboDateString(s.now())
	batch, err := s.repo.InsertBatch(ctx, tx, item, batchRef, canonicalGrams, validatedExpiry, canonicalActor, colomboDate)
	if err != nil {
		return StockBatch{}, err
	}

	if err := s.writeAudit(ctx, tx, audit.Event{
		ActorID: canonicalActor,
		Action:  "stock_batch.received",
		Object:  audit.Object{Type: "stock_batch", ID: batch.ID},
	}); err != nil {
		_ = tx.Rollback(ctx)
		return StockBatch{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return StockBatch{}, err
	}
	return batch, nil
}

// BlockBatch blocks a stock batch with a mandatory reason and records a transactional
// stock_batch.blocked audit event (SRS INV-02, AUD-01–02).
// Permitted role: dispensary.
func (s *Service) BlockBatch(ctx context.Context, actorID, batchID string, req BlockBatchRequest) (StockBatch, error) {
	canonicalBatchID, err := canonicalUUID(batchID, "batchId")
	if err != nil {
		return StockBatch{}, err
	}
	reason, err := validateReason(req.Reason, "reason")
	if err != nil {
		return StockBatch{}, err
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return StockBatch{}, err
	}
	defer tx.Rollback(ctx)

	canonicalActor, err := s.requireRole(ctx, tx, actorID, "dispensary")
	if err != nil {
		return StockBatch{}, err
	}

	colomboDate := ColomboDateString(s.now())
	existing, err := s.repo.GetBatchForUpdate(ctx, tx, canonicalBatchID, colomboDate)
	if err != nil {
		return StockBatch{}, err
	}
	if existing.Blocked {
		return StockBatch{}, fmt.Errorf("%w: stock batch is already blocked", ErrConflict)
	}

	blockedBatch, err := s.repo.BlockBatch(ctx, tx, canonicalBatchID, reason, canonicalActor, colomboDate)
	if err != nil {
		return StockBatch{}, err
	}

	if err := s.writeAudit(ctx, tx, audit.Event{
		ActorID:       canonicalActor,
		Action:        "stock_batch.blocked",
		Object:        audit.Object{Type: "stock_batch", ID: blockedBatch.ID},
		ReasonCode:    "batch_blocked",
		ChangedFields: []string{"blocked", "block_reason"},
	}); err != nil {
		_ = tx.Rollback(ctx)
		return StockBatch{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return StockBatch{}, err
	}
	return blockedBatch, nil
}

// ListBatches returns a paginated list of stock batches with real-time eligibility
// evaluated against the current Asia/Colombo clinic date (SRS INV-02–03).
// Permitted roles: dispensary, report_reader.
func (s *Service) ListBatches(ctx context.Context, actorID string, filter ListBatchesFilter) (StockBatchPage, error) {
	filter.Limit = normalizeLimit(filter.Limit)
	if filter.ItemID != "" {
		canonicalItemID, err := canonicalUUID(filter.ItemID, "itemId")
		if err != nil {
			return StockBatchPage{}, err
		}
		filter.ItemID = canonicalItemID
	}
	if filter.Cursor != "" {
		canonicalCursor, err := canonicalUUID(filter.Cursor, "cursor")
		if err != nil {
			return StockBatchPage{}, err
		}
		filter.Cursor = canonicalCursor
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return StockBatchPage{}, err
	}
	defer tx.Rollback(ctx)

	if _, err := s.requireRole(ctx, tx, actorID, "dispensary", "report_reader"); err != nil {
		return StockBatchPage{}, err
	}

	colomboDate := ColomboDateString(s.now())
	queryFilter := filter
	queryFilter.Limit = filter.Limit + 1

	rows, summary, err := s.repo.ListBatches(ctx, tx, queryFilter, colomboDate)
	if err != nil {
		return StockBatchPage{}, err
	}
	_ = tx.Commit(ctx)

	var nextCursor *string
	if len(rows) > filter.Limit {
		last := rows[filter.Limit-1].ID
		nextCursor = &last
		rows = rows[:filter.Limit]
	}

	return StockBatchPage{
		Items:      rows,
		Summary:    summary,
		ClinicDate: colomboDate,
		NextCursor: nextCursor,
	}, nil
}

func (s *Service) requireRole(ctx context.Context, tx pgx.Tx, actorID string, allowedRoles ...string) (string, error) {
	canonical, err := canonicalUUID(actorID, "actorId")
	if err != nil {
		return "", ErrForbidden
	}
	var active bool
	err = tx.QueryRow(ctx, `SELECT active FROM staff_accounts WHERE id = $1 FOR SHARE`, canonical).Scan(&active)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && !active) {
		return "", ErrForbidden
	}
	if err != nil {
		return "", err
	}
	var hasRole bool
	err = tx.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM staff_roles
			WHERE staff_id = $1 AND role_code = ANY($2::text[])
			FOR SHARE
		)`, canonical, allowedRoles).Scan(&hasRole)
	if err != nil {
		return "", err
	}
	if !hasRole {
		return "", ErrForbidden
	}
	return canonical, nil
}

func canonicalUUID(value, fieldName string) (string, error) {
	var id pgtype.UUID
	if err := id.Scan(value); err != nil || !id.Valid || id.Bytes == [16]byte{} {
		return "", fmt.Errorf("%w: %s must be a valid UUID", ErrValidation, fieldName)
	}
	return id.String(), nil
}

func normalizeLimit(limit int) int {
	if limit <= 0 {
		return 25
	}
	if limit > 100 {
		return 100
	}
	return limit
}
