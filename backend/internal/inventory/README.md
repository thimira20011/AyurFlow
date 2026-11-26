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

## Implemented in `TASK-INV-02`

- Migration [`000016_preparations.up.sql`](../../db/migrations/000016_preparations.up.sql): defines `recipes` (with `version`, `base_yield_grams NUMERIC(12,3)`), `recipe_ingredients` (flat references to `botanical_items`, preventing nested/recursive recipes), `preparations`, `preparation_snapshot_items`, and `batch_consumptions`.
- Domain scaling & recipe service (`preparations.go`):
  - `ScaleIngredientGrams`: deterministic `0.001 g` Round Half Up scaling (`floor((2 * baseMg * targetMg + baseYieldMg) / (2 * baseYieldMg))`) using arbitrary-precision `big.Int` math (`PRE-02`, `DEC03`), rejecting non-positive inputs or results below `0.001 g`.
  - `CreateRecipe` & `UpdateRecipe` (`dispensary`): lock referenced `botanical_items` in ascending UUID order `FOR SHARE`, reject missing (`ErrNotFound`) or deactivated (`ErrConflict`) items, enforce duplicate-ingredient rejection (`ErrValidation`) and optimistic `version` checks (`ErrConflict`), and record `recipe.created` / `recipe.updated` in `audit_events` within the same transaction.
  - `ListRecipes` & `GetRecipe` (`dispensary`, `clinician`, `report_reader`): read flat recipes and resolved ingredient lists without leaking clinical notes or allowing unauthorized roles (`receptionist`, `administrator` without `dispensary`).
- HTTP Transport (`internal/transport/http/preparations.go`): exposes `POST /api/v1/recipes`, `GET /api/v1/recipes`, `GET /api/v1/recipes/:id`, and `PATCH /api/v1/recipes/:id` under `RequireSession` with CSRF protection.
- Frontend (`frontend/src/features/inventory/scaling.ts`, `inventory-live-workflows.tsx`): adds exact `BigInt` milligram scaling preview (`Round Half Up` at `0.001 g`) before saving immutable preparation snapshots and ingredient row removal.
- Automated verification: unit tests (`TestScaleIngredientGrams`, `frontend/tests/inventory-scaling.test.mjs`), HTTP route tests (`TestRecipeHTTPRoutes`), and real PostgreSQL integration tests (`TestTaskINV02FlatRecipesAndScaling` covering `D-PRE-01`, `D-PRE-02`, `AT09`, role boundaries, deactivated item rejection, optimistic version conflict, snapshot preservation, and audit records).

## Implemented in `TASK-INV-03`

- Immutable preparation snapshots (`preparations.go`, `internal/transport/http/preparations.go`):
  - `SavePreparation` (`dispensary`): locks `therapy_sessions`, `care_plans`, `plan_stages`, and active `recipes` `FOR SHARE`; enforces patient-session match, active plan, approved stage, and non-cancelled session; copies `recipe_version`, `item_code`, `item_display_name`, `base_quantity_grams`, and deterministic `required_grams` into `preparations` (`status='prepared'`) and `preparation_snapshot_items` with zero stock deduction or reservation (`PRE-02`, `PRE-03`); records `preparation.created` atomically in `audit_events`.
  - `ListPreparationsFiltered` & `GetPreparation` (`dispensary`): retrieve saved preparation snapshots with optional `sessionId` and `status` (`prepared` / `consumed`) filtering (`GET /api/v1/preparations?patientId=&sessionId=&status=`, `GET /api/v1/preparations/:id`).
  - Database append-only trigger (`protect_preparation_history` in `000016_preparations.up.sql`): blocks `UPDATE`/`DELETE` on `preparation_snapshot_items`, `DELETE` on `preparations`, and mutations to preparation identity/snapshot header fields.
- Frontend (`inventory-live-workflows.tsx`, `api.ts`): immediately renders the newly saved immutable snapshot summary with explicit `Prepared · No Stock Deducted` status, `Asia/Colombo` timestamp, recipe version, and `<TableRegion>` ingredient table; adds `sessionId`/`status` filters to `listPreparations`.
- Automated verification: HTTP tests (`TestPreparationSnapshotHTTPRoutes`) and real PostgreSQL integration tests (`TestTaskINV03ImmutablePreparationSnapshots` covering zero stock deduction, snapshot preservation after recipe updates and botanical item deactivation, database trigger `P0001` enforcement, plan/session guards, filtered listing, RBAC denial, and `preparation.created` audit verification).

## Implemented in `TASK-INV-04`

- Manual batch allocation & atomic actual consumption (`consumption.go`, `internal/transport/http/preparations.go`):
  - `CanonicalizeConsumptionAllocations`: validates manual batch selections (rejecting empty lists, duplicate `batchId`, invalid UUIDs, or invalid gram values), sorts selected batches strictly by `batch_id ASC` for deadlock-free lock ordering (`PRE-04`, `NFR-02`), and computes a canonical order-independent SHA-256 payload fingerprint (`PRE-05`).
  - `ConfirmConsumption` (`dispensary`): acquires `pg_advisory_xact_lock(operationId)`, locks `preparations FOR UPDATE` and `therapy_sessions FOR SHARE`, locks all selected `stock_batches` `FOR UPDATE` in ascending `batch_id ASC` order, rechecks `Asia/Colombo` eligibility (`eligible` only — rejecting `blocked`, `expired`, `unknown_expiry`, and insufficient stock with `ErrConflict`) and exact per-ingredient snapshot reconciliation (`ErrValidation`), atomically deducts `remaining_grams`, inserts `batch_consumptions`, transitions `status = 'consumed'`, inserts `consumption_operations`, and writes `preparation.consumed` in `audit_events` within the same transaction.
- Frontend (`scaling.ts`, `inventory-live-workflows.tsx`): adds pure `BigInt` `reconcileAllocations` helper (zero floating-point drift, zero FEFO/auto-selection), live per-ingredient allocated vs required reconciliation table, remove-batch button, and post-confirmation recorded batch consumptions `<TableRegion>`.
- Automated verification: unit tests (`TestCanonicalizeConsumptionAllocations`, `frontend/tests/inventory-scaling.test.mjs`), HTTP route tests (`TestConfirmConsumptionHTTPRoutes`), and real PostgreSQL integration tests (`TestTaskINV04ManualAllocationAndAtomicConsumption` covering `D-CON-01` 3-batch split commit, `D-CON-03` full rollback across 7 failure modes, `D-CON-05` reverse-order multi-batch deadlock/race safety, `D-CON-06` referenced batch & consumed-history immutability, and RBAC denial).

## Additional implemented slices awaiting D/E review

- `ConfirmConsumption` retry/idempotency edge cases (`TASK-INV-05`) and `TraceBatch` / `TracePatient` / stock reports (`TASK-INV-06`) remain under D/E slice review.
- Formal `AT08`–`AT11` acceptance evidence, Member E peer review, and DEC03 clinic review remain open. No production data is used in any tests.
