# Billing module

Proposed owner: E. Reviewer: D. SRS: BIL-01–06. AT: AT12.

Draft/issued invoices, integer LKR minor units, direct deposits/receipts,
balance protection and idempotent receipt operations.

## Status (TASK-BILL-05 — in review)

| File / Component | Status | Notes |
|---|---|---|
| `domain.go` | ✅ Implemented | Invoice, InvoiceItem, Receipt, Balance, Report types; all money as int64 LKR minor units |
| `repository.go` | ✅ Implemented | Parameterized pgx queries; FOR UPDATE locking; audit event helper |
| `service.go` | ✅ Implemented | Full invoice lifecycle, role checking, atomic issue, idempotent receipt posting (201 Created vs 200 OK replay) |
| `transport/http/billing.go` | ✅ Implemented | Protected routes registered under `RequireSession` in `router.go` with 200 OK for idempotent replays |
| `billing_test.go` | ✅ Implemented | Unit validation tests, balance derivation, money range, and UUID canonicalization |
| `service_integration_test.go` | ✅ Implemented | Direct receipts, deposits, balance, overpayment conflict, retry, concurrency, and audit rollback regressions |
| `000004_billing.up.sql` | ✅ Merged | Invoices, invoice_items, receipts with integrity constraints |
| `frontend/src/features/billing/billing-workspace.tsx` | ✅ Implemented | Live `/api/v1` invoice editor, issued view, receipt drawer, live balance banner, outstanding aging report |
| HTTP routes registered | ✅ Integrated | Wire routes protected by `RequireSession` in `router.go` with CSRF enforcement |
| Role authorization | ✅ Enforced | `billing` and `receptionist` roles checked in PostgreSQL transactions |
| AT12 evidence | ⏳ In progress | Service and HTTP integration tests passing; UAT evidence pending DEC04 |

## Financial rules (enforced throughout this module)

- Money: **int64 LKR minor units** everywhere (Rs. 1 500.00 = 150000). No float64.
- Instants: stored as UTC, displayed as Asia/Colombo by the frontend.
- Rounding rule: **pending DEC04** clinic billing review.
- Receipt `operation_id`: canonical UUID, transaction advisory lock and UNIQUE constraint. Identical retries return the original receipt with HTTP 200 OK (201 Created on new receipt); changed invoice, amount, method or label conflicts.

## Transaction rules

Every mutation (create draft, add item, remove item, issue, void, post receipt) writes an
`audit_events` row **in the same PostgreSQL transaction**. If the audit insert
fails, the entire transaction rolls back. No orphan business state can exist
without an audit record. Billing uses the shared `audit.Write` implementation.

Run `go test -v ./internal/billing/... ./internal/transport/http/...` for unit checks,
and `go test -tags=integration -count=1 ./internal/billing` with a disposable
`TEST_DATABASE_URL` for PostgreSQL concurrency and transaction checks.

## Branch

`member-e/task-bill-05-billing-ui`


## Patient references and report verification

Billing accepts an exact patient registry code or the existing UUID when opening
a draft or loading a patient's invoices. The lookup uses the existing patient
registry number and returns no demographic or clinical fields.

Migration `000017_invoice_patient_reference.up.sql` adds a foreign key that
enforces new references and retains any historical orphan invoices. A database
operator can identify existing orphans with a left join from invoices to
patients on patient_id, filtering for missing patients. Agree a resolution
with A, B and D for any results. Apply a subsequent migration to validate
the constraint after reconciliation.

Billing and report-reader accounts can view committed outstanding balances.
Only issued invoices with a positive balance appear. See the
[manual billing walkthrough](../../../docs/guides/member-e-billing.md).
