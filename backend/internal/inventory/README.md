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

## Additional implemented slices awaiting D/E review

- `SavePreparation`, `ConfirmConsumption`, `TraceBatch`, and `TracePatient` in `preparations.go` and `consumption.go` cover `TASK-INV-03`–`TASK-INV-06` and remain under D/E slice review.
- Formal `AT08`–`AT11` acceptance evidence, Member E peer review, and DEC03 clinic review remain open. No production data is used in any tests.
