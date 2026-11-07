package inventory

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Repository executes parameterized SQL queries for botanical items and stock batches.
type Repository struct {
	pool *pgxpool.Pool
}

// NewRepository creates an inventory Repository.
func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

// InsertItem inserts a new botanical item inside the caller's transaction.
func (r *Repository) InsertItem(ctx context.Context, tx pgx.Tx, code, displayName, actorID string) (BotanicalItem, error) {
	var item BotanicalItem
	err := tx.QueryRow(ctx, `
		INSERT INTO botanical_items (code, display_name, base_unit, created_by)
		VALUES ($1, $2, 'g', $3)
		RETURNING id::text, code, display_name, base_unit, active,
		          deactivated_reason, deactivated_by::text, deactivated_at,
		          created_by::text, created_at, updated_at`,
		code, displayName, actorID,
	).Scan(
		&item.ID, &item.Code, &item.DisplayName, &item.BaseUnit, &item.Active,
		&item.DeactivatedReason, &item.DeactivatedBy, &item.DeactivatedAt,
		&item.CreatedBy, &item.CreatedAt, &item.UpdatedAt,
	)
	if err != nil {
		if isUniqueViolation(err) {
			return BotanicalItem{}, fmt.Errorf("%w: botanical item code already exists", ErrConflict)
		}
		return BotanicalItem{}, err
	}
	return item, nil
}

// GetItemForUpdate locks and returns a botanical item by ID inside the caller's transaction.
func (r *Repository) GetItemForUpdate(ctx context.Context, tx pgx.Tx, itemID string) (BotanicalItem, error) {
	var item BotanicalItem
	err := tx.QueryRow(ctx, `
		SELECT id::text, code, display_name, base_unit, active,
		       deactivated_reason, deactivated_by::text, deactivated_at,
		       created_by::text, created_at, updated_at
		FROM botanical_items
		WHERE id = $1
		FOR UPDATE`,
		itemID,
	).Scan(
		&item.ID, &item.Code, &item.DisplayName, &item.BaseUnit, &item.Active,
		&item.DeactivatedReason, &item.DeactivatedBy, &item.DeactivatedAt,
		&item.CreatedBy, &item.CreatedAt, &item.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return BotanicalItem{}, ErrNotFound
	}
	return item, err
}

// GetItemForShare locks a botanical item with FOR SHARE inside the caller's transaction
// so a concurrent deactivation cannot commit ahead of a batch receipt or recipe creation.
func (r *Repository) GetItemForShare(ctx context.Context, tx pgx.Tx, itemID string) (BotanicalItem, error) {
	var item BotanicalItem
	err := tx.QueryRow(ctx, `
		SELECT id::text, code, display_name, base_unit, active,
		       deactivated_reason, deactivated_by::text, deactivated_at,
		       created_by::text, created_at, updated_at
		FROM botanical_items
		WHERE id = $1
		FOR SHARE`,
		itemID,
	).Scan(
		&item.ID, &item.Code, &item.DisplayName, &item.BaseUnit, &item.Active,
		&item.DeactivatedReason, &item.DeactivatedBy, &item.DeactivatedAt,
		&item.CreatedBy, &item.CreatedAt, &item.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return BotanicalItem{}, ErrNotFound
	}
	return item, err
}

// DeactivateItem marks an active botanical item as inactive with a reason inside the caller's transaction.
func (r *Repository) DeactivateItem(ctx context.Context, tx pgx.Tx, itemID, reason, actorID string) (BotanicalItem, error) {
	var item BotanicalItem
	err := tx.QueryRow(ctx, `
		UPDATE botanical_items
		SET active = false,
		    deactivated_reason = $2,
		    deactivated_by = $3,
		    deactivated_at = clock_timestamp(),
		    updated_at = clock_timestamp()
		WHERE id = $1
		RETURNING id::text, code, display_name, base_unit, active,
		          deactivated_reason, deactivated_by::text, deactivated_at,
		          created_by::text, created_at, updated_at`,
		itemID, reason, actorID,
	).Scan(
		&item.ID, &item.Code, &item.DisplayName, &item.BaseUnit, &item.Active,
		&item.DeactivatedReason, &item.DeactivatedBy, &item.DeactivatedAt,
		&item.CreatedBy, &item.CreatedAt, &item.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return BotanicalItem{}, ErrNotFound
	}
	return item, err
}

// ListItems returns botanical items ordered by display_name ASC, id ASC.
func (r *Repository) ListItems(ctx context.Context, tx pgx.Tx, activeOnly bool, limit int, afterID string) ([]BotanicalItem, error) {
	rows, err := tx.Query(ctx, `
		SELECT id::text, code, display_name, base_unit, active,
		       deactivated_reason, deactivated_by::text, deactivated_at,
		       created_by::text, created_at, updated_at
		FROM botanical_items
		WHERE (NOT $1 OR active = true)
		  AND ($2 = '' OR (display_name, id) > (
		      SELECT display_name, id FROM botanical_items WHERE id = NULLIF($2, '')::uuid
		  ))
		ORDER BY display_name ASC, id ASC
		LIMIT $3`,
		activeOnly, afterID, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]BotanicalItem, 0)
	for rows.Next() {
		var item BotanicalItem
		if err := rows.Scan(
			&item.ID, &item.Code, &item.DisplayName, &item.BaseUnit, &item.Active,
			&item.DeactivatedReason, &item.DeactivatedBy, &item.DeactivatedAt,
			&item.CreatedBy, &item.CreatedAt, &item.UpdatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

// InsertBatch records a new stock batch receipt inside the caller's transaction.
func (r *Repository) InsertBatch(ctx context.Context, tx pgx.Tx, item BotanicalItem, batchReference, receivedGrams string, expiresAt *string, actorID string, colomboDate string) (StockBatch, error) {
	var batch StockBatch
	var expiresDate *time.Time
	err := tx.QueryRow(ctx, `
		INSERT INTO stock_batches (
			item_id, batch_reference, received_grams, remaining_grams, expires_at, received_by
		)
		VALUES ($1, $2, $3::numeric(12,3), $3::numeric(12,3), $4::date, $5)
		RETURNING id::text, item_id::text, batch_reference,
		          received_grams::text, remaining_grams::text,
		          expires_at, blocked, block_reason, blocked_by::text, blocked_at,
		          received_by::text, received_at`,
		item.ID, batchReference, receivedGrams, expiresAt, actorID,
	).Scan(
		&batch.ID, &batch.ItemID, &batch.BatchReference,
		&batch.ReceivedGrams, &batch.RemainingGrams,
		&expiresDate, &batch.Blocked, &batch.BlockReason, &batch.BlockedBy, &batch.BlockedAt,
		&batch.ReceivedBy, &batch.ReceivedAt,
	)
	if err != nil {
		if isUniqueViolation(err) {
			return StockBatch{}, fmt.Errorf("%w: batch reference already exists", ErrConflict)
		}
		return StockBatch{}, err
	}
	batch.ItemCode = item.Code
	batch.ItemDisplayName = item.DisplayName
	if expiresDate != nil {
		formatted := expiresDate.Format("2006-01-02")
		batch.ExpiresAt = &formatted
	}
	remMg, _ := ParseGramsToMilligrams(batch.RemainingGrams, true)
	batch.Eligibility = EvaluateEligibility(batch.Blocked, remMg, batch.ExpiresAt, colomboDate)
	return batch, nil
}

// GetBatchForUpdate locks and returns a stock batch joined with its botanical item inside the caller's transaction.
func (r *Repository) GetBatchForUpdate(ctx context.Context, tx pgx.Tx, batchID string, colomboDate string) (StockBatch, error) {
	var batch StockBatch
	var expiresDate *time.Time
	err := tx.QueryRow(ctx, `
		SELECT b.id::text, b.item_id::text, i.code, i.display_name, b.batch_reference,
		       b.received_grams::text, b.remaining_grams::text,
		       b.expires_at, b.blocked, b.block_reason, b.blocked_by::text, b.blocked_at,
		       b.received_by::text, b.received_at
		FROM stock_batches b
		JOIN botanical_items i ON i.id = b.item_id
		WHERE b.id = $1
		FOR UPDATE OF b`,
		batchID,
	).Scan(
		&batch.ID, &batch.ItemID, &batch.ItemCode, &batch.ItemDisplayName, &batch.BatchReference,
		&batch.ReceivedGrams, &batch.RemainingGrams,
		&expiresDate, &batch.Blocked, &batch.BlockReason, &batch.BlockedBy, &batch.BlockedAt,
		&batch.ReceivedBy, &batch.ReceivedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return StockBatch{}, ErrNotFound
	}
	if err != nil {
		return StockBatch{}, err
	}
	if expiresDate != nil {
		formatted := expiresDate.Format("2006-01-02")
		batch.ExpiresAt = &formatted
	}
	remMg, _ := ParseGramsToMilligrams(batch.RemainingGrams, true)
	batch.Eligibility = EvaluateEligibility(batch.Blocked, remMg, batch.ExpiresAt, colomboDate)
	return batch, nil
}

// BlockBatch marks an unblocked batch as blocked with a reason inside the caller's transaction.
func (r *Repository) BlockBatch(ctx context.Context, tx pgx.Tx, batchID, reason, actorID string, colomboDate string) (StockBatch, error) {
	var batch StockBatch
	var expiresDate *time.Time
	err := tx.QueryRow(ctx, `
		UPDATE stock_batches b
		SET blocked = true,
		    block_reason = $2,
		    blocked_by = $3,
		    blocked_at = clock_timestamp()
		FROM botanical_items i
		WHERE b.id = $1 AND i.id = b.item_id
		RETURNING b.id::text, b.item_id::text, i.code, i.display_name, b.batch_reference,
		          b.received_grams::text, b.remaining_grams::text,
		          b.expires_at, b.blocked, b.block_reason, b.blocked_by::text, b.blocked_at,
		          b.received_by::text, b.received_at`,
		batchID, reason, actorID,
	).Scan(
		&batch.ID, &batch.ItemID, &batch.ItemCode, &batch.ItemDisplayName, &batch.BatchReference,
		&batch.ReceivedGrams, &batch.RemainingGrams,
		&expiresDate, &batch.Blocked, &batch.BlockReason, &batch.BlockedBy, &batch.BlockedAt,
		&batch.ReceivedBy, &batch.ReceivedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return StockBatch{}, ErrNotFound
	}
	if err != nil {
		return StockBatch{}, err
	}
	if expiresDate != nil {
		formatted := expiresDate.Format("2006-01-02")
		batch.ExpiresAt = &formatted
	}
	remMg, _ := ParseGramsToMilligrams(batch.RemainingGrams, true)
	batch.Eligibility = EvaluateEligibility(batch.Blocked, remMg, batch.ExpiresAt, colomboDate)
	return batch, nil
}

// ListBatches returns batches ordered by expires_at ASC NULLS LAST, received_at DESC, id ASC,
// together with summary totals evaluated against colomboDate.
func (r *Repository) ListBatches(ctx context.Context, tx pgx.Tx, filter ListBatchesFilter, colomboDate string) ([]StockBatch, BatchSummaryTotals, error) {
	rows, err := tx.Query(ctx, `
		SELECT b.id::text, b.item_id::text, i.code, i.display_name, b.batch_reference,
		       b.received_grams::text, b.remaining_grams::text,
		       b.expires_at, b.blocked, b.block_reason, b.blocked_by::text, b.blocked_at,
		       b.received_by::text, b.received_at
		FROM stock_batches b
		JOIN botanical_items i ON i.id = b.item_id
		WHERE ($1 = '' OR b.item_id = NULLIF($1, '')::uuid)
		  AND (NOT $2 OR (NOT b.blocked AND b.expires_at IS NOT NULL AND b.expires_at >= $3::date AND b.remaining_grams > 0))
		  AND ($4 = '' OR (b.received_at, b.id) < (
		      SELECT received_at, id FROM stock_batches WHERE id = NULLIF($4, '')::uuid
		  ))
		ORDER BY b.received_at DESC, b.id DESC
		LIMIT $5`,
		filter.ItemID, filter.EligibleOnly, colomboDate, filter.Cursor, filter.Limit,
	)
	if err != nil {
		return nil, BatchSummaryTotals{}, err
	}
	defer rows.Close()

	batches := make([]StockBatch, 0)
	for rows.Next() {
		var batch StockBatch
		var expiresDate *time.Time
		if err := rows.Scan(
			&batch.ID, &batch.ItemID, &batch.ItemCode, &batch.ItemDisplayName, &batch.BatchReference,
			&batch.ReceivedGrams, &batch.RemainingGrams,
			&expiresDate, &batch.Blocked, &batch.BlockReason, &batch.BlockedBy, &batch.BlockedAt,
			&batch.ReceivedBy, &batch.ReceivedAt,
		); err != nil {
			return nil, BatchSummaryTotals{}, err
		}
		if expiresDate != nil {
			formatted := expiresDate.Format("2006-01-02")
			batch.ExpiresAt = &formatted
		}
		remMg, _ := ParseGramsToMilligrams(batch.RemainingGrams, true)
		batch.Eligibility = EvaluateEligibility(batch.Blocked, remMg, batch.ExpiresAt, colomboDate)
		batches = append(batches, batch)
	}
	if err := rows.Err(); err != nil {
		return nil, BatchSummaryTotals{}, err
	}

	summary, err := r.computeSummaryTotals(ctx, tx, filter.ItemID, colomboDate)
	if err != nil {
		return nil, BatchSummaryTotals{}, err
	}

	return batches, summary, nil
}

func (r *Repository) computeSummaryTotals(ctx context.Context, tx pgx.Tx, itemID, colomboDate string) (BatchSummaryTotals, error) {
	var eligibleGrams, blockedGrams, expiredGrams, unknownGrams string
	err := tx.QueryRow(ctx, `
		SELECT
			COALESCE(SUM(CASE WHEN NOT blocked AND expires_at IS NOT NULL AND expires_at >= $2::date AND remaining_grams > 0 THEN remaining_grams ELSE 0 END), 0.000)::numeric(12,3)::text,
			COALESCE(SUM(CASE WHEN blocked THEN remaining_grams ELSE 0 END), 0.000)::numeric(12,3)::text,
			COALESCE(SUM(CASE WHEN NOT blocked AND expires_at IS NOT NULL AND expires_at < $2::date THEN remaining_grams ELSE 0 END), 0.000)::numeric(12,3)::text,
			COALESCE(SUM(CASE WHEN NOT blocked AND expires_at IS NULL THEN remaining_grams ELSE 0 END), 0.000)::numeric(12,3)::text
		FROM stock_batches
		WHERE ($1 = '' OR item_id = NULLIF($1, '')::uuid)`,
		itemID, colomboDate,
	).Scan(&eligibleGrams, &blockedGrams, &expiredGrams, &unknownGrams)
	if err != nil {
		return BatchSummaryTotals{}, err
	}
	return BatchSummaryTotals{
		EligibleGrams:      eligibleGrams,
		BlockedGrams:       blockedGrams,
		ExpiredGrams:       expiredGrams,
		UnknownExpiryGrams: unknownGrams,
	}, nil
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
