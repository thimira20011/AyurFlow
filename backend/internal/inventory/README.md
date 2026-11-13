# Inventory module

Owner: Member D (`K. I. R. Perera`). Reviewer: Member E. SRS: `INV-01`–`04`, `PRE-01`–`06`, `ADM-01`, `AUD-01`–`02`.

## Implemented in `TASK-INV-01`

- Migration [`000014_inventory_batches.up.sql`](../../db/migrations/000014_inventory_batches.up.sql): creates `botanical_items` and `stock_batches` with fixed-precision `NUMERIC(12, 3)` gram columns, deactivation/block state invariants, and retention triggers (`enforce_inventory_batch_retention`) that reject hard deletes and mutations to immutable receipt fields.
- Domain model (`model.go`): exact integer milligram (`int64`) conversion (`ParseGramsToMilligrams`, `FormatMilligramsToGrams`) with zero binary floating-point arithmetic, `Asia/Colombo` clinic date helper (`ColomboDateString`), and batch eligibility evaluator (`EvaluateEligibility`: `eligible`, `blocked`, `expired`, `unknown_expiry`, `depleted`).
- Service & Repository (`service.go`, `repository.go`):
  - `CreateItem` (`dispensary`, `administrator`): inserts `botanical_items` and records `botanical_item.created` in the same transaction.
  - `DeactivateItem` (`dispensary`, `administrator`): marks an active item inactive with a mandatory reason (`botanical_item.deactivated`) while preserving historical batch references (`ADM-01`).
  - `ListItems` (`dispensary`, `administrator`, `report_reader`, `clinician`): bounded pagination ordered by `display_name ASC, id ASC`.
  - `ReceiveBatch` (`dispensary`): locks `botanical_items` `FOR SHARE`, verifies active status, inserts `stock_batches` in fixed-precision grams, and writes `stock_batch.received` in the same transaction.
  - `BlockBatch` (`dispensary`): locks `stock_batches` `FOR UPDATE`, requires a nonblank reason, marks the batch blocked, and writes `stock_batch.blocked` in the same transaction.
  - `ListBatches` (`dispensary`, `report_reader`): lists batches with real-time `eligibility` evaluated against the `Asia/Colombo` date and computes summary totals (`eligibleGrams`, `blockedGrams`, `expiredGrams`, `unknownExpiryGrams`).
- HTTP Transport (`internal/transport/http/inventory.go`): wires `/api/v1/inventory/items` and `/api/v1/inventory/batches` under `RequireSession` (enforcing session cookie, `Origin`, and `X-CSRF-Token`).

## Additional implemented slices awaiting D/E review

- Migration `000016_preparations.up.sql`, `preparations.go` and `consumption.go` add flat recipes with deterministic `0.001 g` scaling, immutable saved preparation snapshots with no stock deduction, manually selected batch allocations, ascending batch locks, atomic consumption and operation-ID retry safety.
- Protected preparation handlers expose recipe, snapshot, consumption and bidirectional traceability actions. PostgreSQL integration tests cover snapshot immutability, rollback, idempotency, access and a concurrent stock race.
- Formal `AT08`–`AT11` acceptance evidence and DEC03 clinic review remain open. No production data is used in the integration tests.
