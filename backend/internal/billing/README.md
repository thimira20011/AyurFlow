# Billing module

Proposed owner: E. Reviewer: D. SRS: BIL-01–06. AT: AT12.

Draft/issued invoices, integer LKR minor units, direct deposits/receipts,
balance protection and idempotent receipt operations.

## Status (TASK-BILL-03 — in review)

| File / Component | Status | Notes |
|---|---|---|
| `domain.go` | ✅ Implemented | Invoice, InvoiceItem, Receipt, Balance, Report types; all money as int64 LKR minor units |
| `repository.go` | ✅ Implemented | Parameterized pgx queries; FOR UPDATE locking; audit event helper |
| `service.go` | ✅ Implemented | Full invoice lifecycle, role checking, atomic issue, idempotent receipt posting |
| `transport/http/billing.go` | ✅ Implemented | Protected routes registered under `RequireSession` in `router.go` |
| `billing_test.go` | ✅ Implemented | Unit validation tests, balance derivation, money range, and UUID canonicalization |
| `service_integration_test.go` | ✅ Implemented | Direct receipts, deposits, balance, overpayment conflict, retry, concurrency, and audit rollback regressions |
| `000004_billing.up.sql` | ✅ Merged | Invoices, invoice_items, receipts with integrity constraints |
| HTTP routes registered | ✅ Integrated | Wire routes protected by `RequireSession` in `router.go` with CSRF enforcement |
| Role authorization | ✅ Enforced | `billing` and `receptionist` roles checked in PostgreSQL transactions |
| AT12 evidence | ⏳ In progress | Service and HTTP integration tests passing; UAT evidence pending DEC04 |

## Financial rules (enforced throughout this module)

- Money: **int64 LKR minor units** everywhere (Rs. 1 500.00 = 150000). No float64.
- Instants: stored as UTC, displayed as Asia/Colombo by the frontend.
- Rounding rule: **pending DEC04** clinic billing review.
- Receipt `operation_id`: canonical UUID, transaction advisory lock and UNIQUE constraint. Identical retries return the original receipt; changed invoice, amount, method or label conflicts.

## Transaction rules

Every mutation (create draft, add item, remove item, issue, void, post receipt) writes an
`audit_events` row **in the same PostgreSQL transaction**. If the audit insert
fails, the entire transaction rolls back. No orphan business state can exist
without an audit record. Billing uses the shared `audit.Write` implementation.

Run `go test -v ./internal/billing/... ./internal/transport/http/...` for unit checks,
and `go test -tags=integration -count=1 ./internal/billing` with a disposable
`TEST_DATABASE_URL` for PostgreSQL concurrency and transaction checks.

## Branch

`member-e/task-bill-03-receipts-balance`

