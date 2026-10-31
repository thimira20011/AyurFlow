package billing

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Service enforces authorization, workflow rules and transaction boundaries
// for all billing operations. All protected mutations write an audit event
// in the same transaction; a failed audit write rolls back the mutation.
//
// AUTH-03 (role and record checks) is not yet implemented. Every method that
// requires a caller identity accepts actorID and roles parameters so that the
// permission logic can be added in place once AUTH-03 lands. Methods marked
// with "AUTH-03 TODO" must not be exposed on protected routes until that work
// is integrated.
//
// DEC04 TODO: rounding rule, allowed payment methods and tariff examples must
// be confirmed with the clinic billing staff before AT12 acceptance.
type Service struct {
	pool *pgxpool.Pool
	repo *Repository
}

// NewService creates a billing Service.
func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool, repo: NewRepository(pool)}
}

// ---------------------------------------------------------------------------
// Invoice lifecycle
// ---------------------------------------------------------------------------

// CreateInvoice opens a new draft invoice for the given patient.
func (s *Service) CreateInvoice(ctx context.Context, actorID string, req CreateInvoiceRequest) (Invoice, error) {
	if strings.TrimSpace(req.PatientID) == "" {
		return Invoice{}, fmt.Errorf("%w: patientId is required", ErrValidation)
	}
	canonicalPatient, err := canonicalUUID(req.PatientID)
	if err != nil {
		return Invoice{}, fmt.Errorf("%w: patientId must be a valid UUID", ErrValidation)
	}
	req.PatientID = canonicalPatient

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Invoice{}, err
	}
	defer tx.Rollback(ctx)

	if err := s.checkRole(ctx, tx, actorID, "billing", "receptionist"); err != nil {
		return Invoice{}, err
	}

	inv, err := s.repo.CreateInvoice(ctx, tx, req.PatientID)
	if err != nil {
		return Invoice{}, err
	}

	if err := s.repo.RecordAuditEvent(ctx, tx,
		actorID, "invoice.created", "invoice", inv.ID, ""); err != nil {
		return Invoice{}, err // rolls back the invoice insert
	}

	if err := tx.Commit(ctx); err != nil {
		return Invoice{}, err
	}
	return inv, nil
}

// GetInvoice returns a single invoice with its line items.
func (s *Service) GetInvoice(ctx context.Context, actorID string, invoiceID string) (Invoice, error) {
	canonicalInvoice, err := canonicalUUID(invoiceID)
	if err != nil {
		return Invoice{}, fmt.Errorf("%w: invoiceId must be a valid UUID", ErrValidation)
	}
	invoiceID = canonicalInvoice

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Invoice{}, err
	}
	defer tx.Rollback(ctx)

	if err := s.checkRole(ctx, tx, actorID, "billing", "receptionist"); err != nil {
		return Invoice{}, err
	}

	inv, err := s.repo.GetInvoice(ctx, invoiceID)
	if err != nil {
		return Invoice{}, err
	}
	inv.Items, err = s.repo.GetInvoiceItems(ctx, invoiceID)
	if err != nil {
		return Invoice{}, err
	}
	_ = tx.Commit(ctx)
	return inv, nil
}

// ListInvoicesForPatient returns a paginated list of invoices for one patient.
func (s *Service) ListInvoicesForPatient(ctx context.Context, actorID string, patientID string, limit int, afterID string) (InvoicePage, error) {
	canonicalPatient, err := canonicalUUID(patientID)
	if err != nil {
		return InvoicePage{}, fmt.Errorf("%w: patientId must be a valid UUID", ErrValidation)
	}
	patientID = canonicalPatient

	if afterID != "" {
		canonicalAfter, err := canonicalUUID(afterID)
		if err != nil {
			return InvoicePage{}, fmt.Errorf("%w: after cursor must be a valid UUID", ErrValidation)
		}
		afterID = canonicalAfter
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return InvoicePage{}, err
	}
	defer tx.Rollback(ctx)

	if err := s.checkRole(ctx, tx, actorID, "billing", "receptionist"); err != nil {
		return InvoicePage{}, err
	}

	if limit <= 0 || limit > 100 {
		limit = 25
	}
	// Fetch limit+1 to detect whether there is a next page.
	items, err := s.repo.ListInvoicesForPatient(ctx, patientID, limit+1, afterID)
	if err != nil {
		return InvoicePage{}, err
	}
	var nextCursor *string
	if len(items) > limit {
		items = items[:limit]
		last := items[len(items)-1].ID
		nextCursor = &last
	}
	_ = tx.Commit(ctx)
	return InvoicePage{Items: items, NextCursor: nextCursor}, nil
}

// AddItem adds a line item to a draft invoice.
func (s *Service) AddItem(ctx context.Context, actorID, invoiceID string, req AddItemRequest) (InvoiceItem, error) {
	if err := validateAddItem(req); err != nil {
		return InvoiceItem{}, err
	}
	canonicalInvoice, err := canonicalUUID(invoiceID)
	if err != nil {
		return InvoiceItem{}, fmt.Errorf("%w: invoiceId must be a valid UUID", ErrValidation)
	}
	invoiceID = canonicalInvoice

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return InvoiceItem{}, err
	}
	defer tx.Rollback(ctx)

	if err := s.checkRole(ctx, tx, actorID, "billing"); err != nil {
		return InvoiceItem{}, err
	}

	inv, err := s.repo.GetInvoiceForUpdate(ctx, tx, invoiceID)
	if err != nil {
		return InvoiceItem{}, err
	}
	if inv.Status != StatusDraft {
		return InvoiceItem{}, fmt.Errorf("%w: invoice is %s, only draft invoices accept new items", ErrConflict, inv.Status)
	}

	item, err := s.repo.AddInvoiceItem(ctx, tx, invoiceID, req.Description, req.Quantity, req.UnitPriceMinor)
	if err != nil {
		return InvoiceItem{}, err
	}

	if err := s.repo.RecordAuditEvent(ctx, tx,
		actorID, "invoice.item_added", "invoice", invoiceID, ""); err != nil {
		return InvoiceItem{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return InvoiceItem{}, err
	}
	return item, nil
}

// RemoveItem removes a line item from a draft invoice.
func (s *Service) RemoveItem(ctx context.Context, actorID, invoiceID, itemID string) error {
	canonicalInvoice, err := canonicalUUID(invoiceID)
	if err != nil {
		return fmt.Errorf("%w: invoiceId must be a valid UUID", ErrValidation)
	}
	invoiceID = canonicalInvoice

	canonicalItem, err := canonicalUUID(itemID)
	if err != nil {
		return fmt.Errorf("%w: itemId must be a valid UUID", ErrValidation)
	}
	itemID = canonicalItem

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if err := s.checkRole(ctx, tx, actorID, "billing"); err != nil {
		return err
	}

	inv, err := s.repo.GetInvoiceForUpdate(ctx, tx, invoiceID)
	if err != nil {
		return err
	}
	if inv.Status != StatusDraft {
		return fmt.Errorf("%w: cannot remove items from a %s invoice", ErrConflict, inv.Status)
	}

	if err := s.repo.RemoveInvoiceItem(ctx, tx, itemID, invoiceID); err != nil {
		return err
	}

	if err := s.repo.RecordAuditEvent(ctx, tx,
		actorID, "invoice.item_removed", "invoice", invoiceID, ""); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// IssueInvoice atomically locks the invoice, computes the total from its lines,
// and transitions it to 'issued'. An issued invoice is immutable.
func (s *Service) IssueInvoice(ctx context.Context, actorID, invoiceID string) (Invoice, error) {
	canonicalInvoice, err := canonicalUUID(invoiceID)
	if err != nil {
		return Invoice{}, fmt.Errorf("%w: invoiceId must be a valid UUID", ErrValidation)
	}
	invoiceID = canonicalInvoice

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Invoice{}, err
	}
	defer tx.Rollback(ctx)

	if err := s.checkRole(ctx, tx, actorID, "billing"); err != nil {
		return Invoice{}, err
	}

	// Lock the row to serialize concurrent issue attempts.
	inv, err := s.repo.GetInvoiceForUpdate(ctx, tx, invoiceID)
	if err != nil {
		return Invoice{}, err
	}
	if inv.Status != StatusDraft {
		return Invoice{}, fmt.Errorf("%w: invoice is already %s", ErrConflict, inv.Status)
	}

	totalMinor, err := s.repo.SumInvoiceItems(ctx, tx, invoiceID)
	if err != nil {
		return Invoice{}, err
	}
	if totalMinor == 0 {
		return Invoice{}, fmt.Errorf("%w: cannot issue an invoice with no items or a zero total", ErrValidation)
	}

	if err := s.repo.IssueInvoice(ctx, tx, invoiceID, totalMinor, actorID); err != nil {
		return Invoice{}, err
	}

	// Audit event in the same transaction; failure rolls back the issue.
	if err := s.repo.RecordAuditEvent(ctx, tx,
		actorID, "invoice.issued", "invoice", invoiceID, ""); err != nil {
		return Invoice{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return Invoice{}, err
	}

	// Re-fetch the fully updated invoice with lines.
	return s.GetInvoice(ctx, actorID, invoiceID)
}

// VoidInvoice transitions a draft invoice to 'void'. Fails if any receipts exist.
func (s *Service) VoidInvoice(ctx context.Context, actorID, invoiceID string) error {
	canonicalInvoice, err := canonicalUUID(invoiceID)
	if err != nil {
		return fmt.Errorf("%w: invoiceId must be a valid UUID", ErrValidation)
	}
	invoiceID = canonicalInvoice

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if err := s.checkRole(ctx, tx, actorID, "billing"); err != nil {
		return err
	}

	inv, err := s.repo.GetInvoiceForUpdate(ctx, tx, invoiceID)
	if err != nil {
		return err
	}
	if inv.Status != StatusDraft {
		return fmt.Errorf("%w: can only void a draft invoice, current status is %s", ErrConflict, inv.Status)
	}

	// Guard: no receipts should exist on a draft, but check defensively.
	paid, err := s.repo.SumReceipts(ctx, tx, invoiceID)
	if err != nil {
		return err
	}
	if paid > 0 {
		return fmt.Errorf("%w: invoice has receipts and cannot be voided", ErrConflict)
	}

	if err := s.repo.VoidInvoice(ctx, tx, invoiceID); err != nil {
		return err
	}

	if err := s.repo.RecordAuditEvent(ctx, tx,
		actorID, "invoice.voided", "invoice", invoiceID, ""); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// ---------------------------------------------------------------------------
// Receipts and balance
// ---------------------------------------------------------------------------

// PostReceipt posts a payment receipt against an issued invoice.
// Idempotency: if operationID already exists, the existing receipt is returned
// without writing a duplicate (AT12 retry safety).
// Concurrency: the invoice row is locked FOR UPDATE before the overpayment
// check, serializing concurrent receipt posts on the same invoice.
func (s *Service) PostReceipt(ctx context.Context, actorID, invoiceID string, req PostReceiptRequest) (Receipt, error) {
	if err := validatePostReceipt(req); err != nil {
		return Receipt{}, err
	}
	canonicalInvoice, err := canonicalUUID(invoiceID)
	if err != nil {
		return Receipt{}, fmt.Errorf("%w: invoiceId must be a UUID", ErrValidation)
	}
	invoiceID = canonicalInvoice
	// Validation above already checked this conversion. Canonicalize so alternate
	// UUID spellings cannot acquire different locks for the same operation.
	req.OperationID, err = canonicalUUID(req.OperationID)
	if err != nil {
		return Receipt{}, err
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Receipt{}, err
	}
	defer tx.Rollback(ctx)

	if err := s.checkRole(ctx, tx, actorID, "billing"); err != nil {
		return Receipt{}, err
	}

	if err := s.repo.LockReceiptOperation(ctx, tx, req.OperationID); err != nil {
		return Receipt{}, err
	}

	// Idempotency check: return existing receipt if operationID already committed.
	existing, err := s.repo.FindReceiptByOperationID(ctx, tx, req.OperationID)
	if err == nil {
		sameTarget := existing.InvoiceID == invoiceID && existing.AmountMinor == req.AmountMinor
		sameDetails := existing.PaymentMethod == req.PaymentMethod && existing.Label == req.Label
		if !sameTarget || !sameDetails {
			return Receipt{}, fmt.Errorf("%w: operationId was used with different receipt details", ErrConflict)
		}
		if err := tx.Commit(ctx); err != nil {
			return Receipt{}, err
		}
		return existing, nil
	}
	if !errors.Is(err, ErrNotFound) {
		return Receipt{}, err
	}

	// Lock the invoice row to serialize balance checks.
	inv, err := s.repo.GetInvoiceForUpdate(ctx, tx, invoiceID)
	if err != nil {
		return Receipt{}, err
	}
	if inv.Status != StatusIssued {
		return Receipt{}, fmt.Errorf("%w: can only post receipts against an issued invoice (status: %s)", ErrConflict, inv.Status)
	}

	paid, err := s.repo.SumReceipts(ctx, tx, invoiceID)
	if err != nil {
		return Receipt{}, err
	}
	if inv.TotalMinor == nil || paid < 0 {
		return Receipt{}, fmt.Errorf("%w: invalid invoice balance", ErrConflict)
	}
	total := *inv.TotalMinor
	if total < 0 || paid > total {
		return Receipt{}, fmt.Errorf("%w: invalid invoice balance", ErrConflict)
	}
	if req.AmountMinor > total-paid {
		return Receipt{}, fmt.Errorf("%w: receipt amount would exceed the invoice total (outstanding: %d minor units)", ErrConflict, *inv.TotalMinor-paid)
	}

	rec, err := s.repo.InsertReceipt(ctx, tx, invoiceID, req.OperationID, req.AmountMinor, req.PaymentMethod, req.Label, actorID)
	if err != nil {
		return Receipt{}, err
	}

	// Audit in the same transaction; failure rolls back the receipt insert.
	if err := s.repo.RecordAuditEvent(ctx, tx,
		actorID, "receipt.posted", "receipt", rec.ID, ""); err != nil {
		return Receipt{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return Receipt{}, err
	}
	return rec, nil
}

// GetBalance returns the derived balance for an issued invoice.
func (s *Service) GetBalance(ctx context.Context, actorID string, invoiceID string) (InvoiceBalance, error) {
	canonicalInvoice, err := canonicalUUID(invoiceID)
	if err != nil {
		return InvoiceBalance{}, fmt.Errorf("%w: invoiceId must be a valid UUID", ErrValidation)
	}
	invoiceID = canonicalInvoice

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return InvoiceBalance{}, err
	}
	defer tx.Rollback(ctx)

	if err := s.checkRole(ctx, tx, actorID, "billing", "receptionist"); err != nil {
		return InvoiceBalance{}, err
	}

	inv, err := s.repo.GetInvoice(ctx, invoiceID)
	if err != nil {
		return InvoiceBalance{}, err
	}
	if inv.Status != StatusIssued {
		return InvoiceBalance{}, fmt.Errorf("%w: balance is only available for issued invoices", ErrConflict)
	}

	paid, err := s.repo.SumReceipts(ctx, tx, invoiceID)
	if err != nil {
		return InvoiceBalance{}, err
	}
	_ = tx.Commit(ctx)

	return InvoiceBalance{
		InvoiceID:        invoiceID,
		TotalMinor:       *inv.TotalMinor,
		PaidMinor:        paid,
		OutstandingMinor: *inv.TotalMinor - paid,
	}, nil
}

// ListReceipts returns all receipts for an invoice.
func (s *Service) ListReceipts(ctx context.Context, actorID string, invoiceID string) ([]Receipt, error) {
	canonicalInvoice, err := canonicalUUID(invoiceID)
	if err != nil {
		return nil, fmt.Errorf("%w: invoiceId must be a valid UUID", ErrValidation)
	}
	invoiceID = canonicalInvoice

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	if err := s.checkRole(ctx, tx, actorID, "billing", "receptionist"); err != nil {
		return nil, err
	}

	// Confirm invoice exists before querying receipts.
	if _, err := s.repo.GetInvoice(ctx, invoiceID); err != nil {
		return nil, err
	}
	receipts, err := s.repo.ListReceipts(ctx, invoiceID)
	if err != nil {
		return nil, err
	}
	_ = tx.Commit(ctx)
	return receipts, nil
}

// ---------------------------------------------------------------------------
// Reports (TASK-BILL-06)
// ---------------------------------------------------------------------------

// OutstandingReport returns all issued invoices with a remaining balance.
func (s *Service) OutstandingReport(ctx context.Context, actorID string) (OutstandingReport, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return OutstandingReport{}, err
	}
	defer tx.Rollback(ctx)

	if err := s.checkRole(ctx, tx, actorID, "billing", "report_reader"); err != nil {
		return OutstandingReport{}, err
	}

	rows, err := s.repo.OutstandingInvoices(ctx)
	if err != nil {
		return OutstandingReport{}, err
	}
	_ = tx.Commit(ctx)
	return OutstandingReport{
		GeneratedAt: time.Now().UTC(),
		Rows:        rows,
	}, nil
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

func validateAddItem(req AddItemRequest) error {
	var errs []string
	if strings.TrimSpace(req.Description) == "" {
		errs = append(errs, "description is required")
	}
	if req.Quantity <= 0 {
		errs = append(errs, "quantity must be positive")
	}
	if req.Quantity > math.MaxInt32 {
		errs = append(errs, "quantity exceeds the database integer limit")
	}
	if req.UnitPriceMinor < 0 {
		errs = append(errs, "unitPriceMinor must be non-negative")
	}
	if req.Quantity > 0 && req.UnitPriceMinor > math.MaxInt64/int64(req.Quantity) {
		errs = append(errs, "line total exceeds supported money range")
	}
	if len(errs) > 0 {
		return fmt.Errorf("%w: %s", ErrValidation, strings.Join(errs, "; "))
	}
	return nil
}

func validatePostReceipt(req PostReceiptRequest) error {
	var errs []string
	if _, err := canonicalUUID(req.OperationID); err != nil {
		errs = append(errs, "operationId must be a UUID")
	}
	if req.AmountMinor <= 0 {
		errs = append(errs, "amountMinor must be positive")
	}
	if req.PaymentMethod != "cash" && req.PaymentMethod != "direct_deposit" {
		errs = append(errs, "paymentMethod must be 'cash' or 'direct_deposit'")
	}
	if len(errs) > 0 {
		return fmt.Errorf("%w: %s", ErrValidation, strings.Join(errs, "; "))
	}
	return nil
}

func canonicalUUID(value string) (string, error) {
	var id pgtype.UUID
	if err := id.Scan(value); err != nil || !id.Valid || id.Bytes == [16]byte{} {
		return "", ErrValidation
	}
	return id.String(), nil
}

func (s *Service) checkRole(ctx context.Context, tx pgx.Tx, actorID string, allowedRoles ...string) error {
	canonical, err := canonicalUUID(actorID)
	if err != nil {
		return ErrForbidden
	}
	var active bool
	err = tx.QueryRow(ctx, `SELECT active FROM staff_accounts WHERE id=$1 FOR SHARE`, canonical).Scan(&active)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && !active) {
		return ErrForbidden
	}
	if err != nil {
		return err
	}
	var exists bool
	err = tx.QueryRow(ctx, `SELECT EXISTS(
		SELECT 1 FROM staff_roles WHERE staff_id=$1 AND role_code = ANY($2::text[])
	)`, canonical, allowedRoles).Scan(&exists)
	if err != nil {
		return err
	}
	if !exists {
		return ErrForbidden
	}
	return nil
}
