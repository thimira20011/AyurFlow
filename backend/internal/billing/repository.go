package billing

import (
	"context"
	"errors"

	"ayurflow/backend/internal/audit"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Repository implements all parameterized database access for the billing
// module. Handlers and services must never write raw SQL outside this file.
// All queries use $N placeholders to prevent SQL injection.
type Repository struct {
	pool *pgxpool.Pool
}

// NewRepository creates a Repository backed by the shared connection pool.
func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

// ---------------------------------------------------------------------------
// Invoice queries
// ---------------------------------------------------------------------------

// GetInvoice fetches a single invoice by ID. Returns ErrNotFound when absent.
// Items are NOT loaded; call GetInvoiceItems separately.
func (r *Repository) GetInvoice(ctx context.Context, id string) (Invoice, error) {
	var inv Invoice
	err := r.pool.QueryRow(ctx, `
		SELECT id::text, patient_id::text, status,
		       total_minor_units, issued_at, issued_by::text,
		       created_at, updated_at
		FROM invoices WHERE id = $1`, id,
	).Scan(
		&inv.ID, &inv.PatientID, &inv.Status,
		&inv.TotalMinor, &inv.IssuedAt, &inv.IssuedBy,
		&inv.CreatedAt, &inv.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return Invoice{}, ErrNotFound
	}
	return inv, err
}

// GetInvoiceForUpdate fetches an invoice row with FOR UPDATE within an open
// transaction. Used by issue and receipt operations to serialize concurrent
// writes on the same invoice.
func (r *Repository) GetInvoiceForUpdate(ctx context.Context, tx pgx.Tx, id string) (Invoice, error) {
	var inv Invoice
	err := tx.QueryRow(ctx, `
		SELECT id::text, patient_id::text, status,
		       total_minor_units, issued_at, issued_by::text,
		       created_at, updated_at
		FROM invoices WHERE id = $1 FOR UPDATE`, id,
	).Scan(
		&inv.ID, &inv.PatientID, &inv.Status,
		&inv.TotalMinor, &inv.IssuedAt, &inv.IssuedBy,
		&inv.CreatedAt, &inv.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return Invoice{}, ErrNotFound
	}
	return inv, err
}

// ListInvoicesForPatient returns a page of invoices for one patient, ordered
// by created_at DESC with id as tie-breaker. Cursor is opaque (id-based).
func (r *Repository) ListInvoicesForPatient(ctx context.Context, patientID string, limit int, afterID string) ([]Invoice, error) {
	q := `SELECT id::text, patient_id::text, status,
		         total_minor_units, issued_at, issued_by::text,
		         created_at, updated_at
		  FROM invoices WHERE patient_id = $1`
	args := []any{patientID}
	if afterID != "" {
		q += ` AND (created_at, id) < (
				SELECT created_at, id FROM invoices WHERE id = $2
			  )`
		args = append(args, afterID)
	}
	q += ` ORDER BY created_at DESC, id DESC LIMIT $` + itoa(len(args)+1)
	args = append(args, limit)

	rows, err := r.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanInvoiceRows(rows)
}

// CreateInvoice inserts a new draft invoice and returns the created record.
func (r *Repository) CreateInvoice(ctx context.Context, tx pgx.Tx, patientID string) (Invoice, error) {
	var inv Invoice
	err := tx.QueryRow(ctx, `
		INSERT INTO invoices (patient_id)
		VALUES ($1)
		RETURNING id::text, patient_id::text, status,
		          total_minor_units, issued_at, issued_by::text,
		          created_at, updated_at`, patientID,
	).Scan(
		&inv.ID, &inv.PatientID, &inv.Status,
		&inv.TotalMinor, &inv.IssuedAt, &inv.IssuedBy,
		&inv.CreatedAt, &inv.UpdatedAt,
	)
	return inv, err
}

// IssueInvoice atomically marks an invoice as issued with its computed total.
// Must be called inside a transaction that holds FOR UPDATE on the invoice row.
func (r *Repository) IssueInvoice(ctx context.Context, tx pgx.Tx, id string, totalMinor int64, issuedBy string) error {
	_, err := tx.Exec(ctx, `
		UPDATE invoices
		SET status = 'issued',
		    total_minor_units = $2,
		    issued_at = now(),
		    issued_by = $3,
		    updated_at = now()
		WHERE id = $1 AND status = 'draft'`, id, totalMinor, issuedBy)
	return err
}

// VoidInvoice marks a draft invoice as void. Fails if receipts exist (enforced
// in the service layer before calling this).
func (r *Repository) VoidInvoice(ctx context.Context, tx pgx.Tx, id string) error {
	_, err := tx.Exec(ctx, `
		UPDATE invoices
		SET status = 'void', updated_at = now()
		WHERE id = $1 AND status = 'draft'`, id)
	return err
}

// ---------------------------------------------------------------------------
// Invoice item queries
// ---------------------------------------------------------------------------

// GetInvoiceItems returns all line items for an invoice, ordered by created_at.
func (r *Repository) GetInvoiceItems(ctx context.Context, invoiceID string) ([]InvoiceItem, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id::text, invoice_id::text, description,
		       quantity, unit_price_minor, created_at
		FROM invoice_items WHERE invoice_id = $1
		ORDER BY created_at ASC, id ASC`, invoiceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanItemRows(rows)
}

// AddInvoiceItem inserts a new line item and returns it. Must only be called
// while the invoice is in draft status (service enforces this).
func (r *Repository) AddInvoiceItem(ctx context.Context, tx pgx.Tx, invoiceID, description string, quantity int, unitPriceMinor int64) (InvoiceItem, error) {
	var item InvoiceItem
	err := tx.QueryRow(ctx, `
		INSERT INTO invoice_items (invoice_id, description, quantity, unit_price_minor)
		VALUES ($1, $2, $3, $4)
		RETURNING id::text, invoice_id::text, description,
		          quantity, unit_price_minor, created_at`,
		invoiceID, description, quantity, unitPriceMinor,
	).Scan(
		&item.ID, &item.InvoiceID, &item.Description,
		&item.Quantity, &item.UnitPriceMinor, &item.CreatedAt,
	)
	if err == nil {
		item.LineTotalMinor = int64(item.Quantity) * item.UnitPriceMinor
	}
	return item, err
}

// RemoveInvoiceItem deletes a line item by ID. Service checks draft status first.
func (r *Repository) RemoveInvoiceItem(ctx context.Context, tx pgx.Tx, itemID, invoiceID string) error {
	_, err := tx.Exec(ctx, `
		DELETE FROM invoice_items WHERE id = $1 AND invoice_id = $2`,
		itemID, invoiceID)
	return err
}

// SumInvoiceItems computes the total for all lines of an invoice.
// Returns 0 when the invoice has no lines.
func (r *Repository) SumInvoiceItems(ctx context.Context, tx pgx.Tx, invoiceID string) (int64, error) {
	var total int64
	err := tx.QueryRow(ctx, `
		SELECT COALESCE(SUM(quantity::bigint * unit_price_minor), 0)
		FROM invoice_items WHERE invoice_id = $1`, invoiceID,
	).Scan(&total)
	return total, err
}

// ---------------------------------------------------------------------------
// Receipt queries
// ---------------------------------------------------------------------------

// FindReceiptByOperationID looks up a receipt by idempotency key.
// Returns ErrNotFound when absent (caller then proceeds to insert).
func (r *Repository) FindReceiptByOperationID(ctx context.Context, tx pgx.Tx, operationID string) (Receipt, error) {
	var rec Receipt
	err := tx.QueryRow(ctx, `
		SELECT id::text, invoice_id::text, operation_id::text,
		       amount_minor, payment_method, COALESCE(label, ''),
		       issued_at, issued_by::text
		FROM receipts WHERE operation_id = $1`, operationID,
	).Scan(
		&rec.ID, &rec.InvoiceID, &rec.OperationID,
		&rec.AmountMinor, &rec.PaymentMethod, &rec.Label,
		&rec.IssuedAt, &rec.IssuedBy,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return Receipt{}, ErrNotFound
	}
	return rec, err
}

// LockReceiptOperation serializes retries across all invoices before invoice-row
// locking. A hash collision only serializes unrelated operations; it grants no access.
func (r *Repository) LockReceiptOperation(ctx context.Context, tx pgx.Tx, operationID string) error {
	_, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1, 771204))`, operationID)
	return err
}

// SumReceipts returns the total amount posted against an invoice so far.
func (r *Repository) SumReceipts(ctx context.Context, tx pgx.Tx, invoiceID string) (int64, error) {
	var total int64
	err := tx.QueryRow(ctx, `
		SELECT COALESCE(SUM(amount_minor), 0)
		FROM receipts WHERE invoice_id = $1`, invoiceID,
	).Scan(&total)
	return total, err
}

// InsertReceipt inserts a validated receipt row within an open transaction.
// The caller must have already checked balance and idempotency.
func (r *Repository) InsertReceipt(ctx context.Context, tx pgx.Tx, invoiceID, operationID string, amountMinor int64, method, label, issuedBy string) (Receipt, error) {
	var rec Receipt
	err := tx.QueryRow(ctx, `
		INSERT INTO receipts
		  (invoice_id, operation_id, amount_minor, payment_method, label, issued_by)
		VALUES ($1, $2, $3, $4, NULLIF($5, ''), $6)
		RETURNING id::text, invoice_id::text, operation_id::text,
		          amount_minor, payment_method, COALESCE(label, ''),
		          issued_at, issued_by::text`,
		invoiceID, operationID, amountMinor, method, label, issuedBy,
	).Scan(
		&rec.ID, &rec.InvoiceID, &rec.OperationID,
		&rec.AmountMinor, &rec.PaymentMethod, &rec.Label,
		&rec.IssuedAt, &rec.IssuedBy,
	)
	return rec, err
}

// ListReceipts returns all receipts for an invoice, ordered by issued_at.
func (r *Repository) ListReceipts(ctx context.Context, invoiceID string) ([]Receipt, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id::text, invoice_id::text, operation_id::text,
		       amount_minor, payment_method, COALESCE(label, ''),
		       issued_at, issued_by::text
		FROM receipts WHERE invoice_id = $1
		ORDER BY issued_at ASC, id ASC`, invoiceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var recs []Receipt
	for rows.Next() {
		var rec Receipt
		if err := rows.Scan(
			&rec.ID, &rec.InvoiceID, &rec.OperationID,
			&rec.AmountMinor, &rec.PaymentMethod, &rec.Label,
			&rec.IssuedAt, &rec.IssuedBy,
		); err != nil {
			return nil, err
		}
		recs = append(recs, rec)
	}
	return recs, rows.Err()
}

// ---------------------------------------------------------------------------
// Report query (TASK-BILL-06)
// ---------------------------------------------------------------------------

// OutstandingInvoices returns all issued invoices with outstanding balances.
// Access control (role + record) is enforced by the service before calling this.
func (r *Repository) OutstandingInvoices(ctx context.Context) ([]OutstandingReportRow, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT i.id::text, i.patient_id::text, i.issued_at,
		       i.total_minor_units,
		       COALESCE(SUM(rec.amount_minor), 0)          AS paid_minor,
		       i.total_minor_units - COALESCE(SUM(rec.amount_minor), 0) AS outstanding_minor,
		       EXTRACT(DAY FROM now() - i.issued_at)::int  AS age_days
		FROM invoices i
		LEFT JOIN receipts rec ON rec.invoice_id = i.id
		WHERE i.status = 'issued'
		  AND i.total_minor_units > COALESCE(
		      (SELECT SUM(r2.amount_minor) FROM receipts r2 WHERE r2.invoice_id = i.id), 0)
		GROUP BY i.id, i.patient_id, i.issued_at, i.total_minor_units
		ORDER BY i.issued_at ASC, i.id ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []OutstandingReportRow
	for rows.Next() {
		var row OutstandingReportRow
		if err := rows.Scan(
			&row.InvoiceID, &row.PatientID, &row.IssuedAt,
			&row.TotalMinor, &row.PaidMinor, &row.OutstandingMinor, &row.AgeDays,
		); err != nil {
			return nil, err
		}
		result = append(result, row)
	}
	return result, rows.Err()
}

// ---------------------------------------------------------------------------
// Audit helper (used by service to write events in the same transaction)
// ---------------------------------------------------------------------------

// RecordAuditEvent writes a critical audit event within an existing transaction.
// A failed write must cause the caller's transaction to roll back (the caller
// defers tx.Rollback, so returning an error achieves this automatically).
func (r *Repository) RecordAuditEvent(ctx context.Context, tx pgx.Tx, actorID, action, objectType, objectID, reason string) error {
	return audit.Write(ctx, tx, audit.Event{
		ActorID:       actorID,
		Action:        action,
		Object:        audit.Object{Type: objectType, ID: objectID},
		ReasonCode:    reason,
		ChangedFields: []string{},
	})
}

// ---------------------------------------------------------------------------
// Internal scan helpers
// ---------------------------------------------------------------------------

func scanInvoiceRows(rows pgx.Rows) ([]Invoice, error) {
	var invoices []Invoice
	for rows.Next() {
		var inv Invoice
		if err := rows.Scan(
			&inv.ID, &inv.PatientID, &inv.Status,
			&inv.TotalMinor, &inv.IssuedAt, &inv.IssuedBy,
			&inv.CreatedAt, &inv.UpdatedAt,
		); err != nil {
			return nil, err
		}
		invoices = append(invoices, inv)
	}
	return invoices, rows.Err()
}

func scanItemRows(rows pgx.Rows) ([]InvoiceItem, error) {
	var items []InvoiceItem
	for rows.Next() {
		var item InvoiceItem
		if err := rows.Scan(
			&item.ID, &item.InvoiceID, &item.Description,
			&item.Quantity, &item.UnitPriceMinor, &item.CreatedAt,
		); err != nil {
			return nil, err
		}
		item.LineTotalMinor = int64(item.Quantity) * item.UnitPriceMinor
		items = append(items, item)
	}
	return items, rows.Err()
}

// itoa converts int to decimal string (avoids importing strconv at call sites).
func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	buf := make([]byte, 0, 10)
	for n > 0 {
		buf = append([]byte{byte('0' + n%10)}, buf...)
		n /= 10
	}
	return string(buf)
}
