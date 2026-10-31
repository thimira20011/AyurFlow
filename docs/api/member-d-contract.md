# Member D botanical inventory, recipes, preparation and consumption contract — TASK-SET-06 review draft

**Owner:** Member D (`K. I. R. Perera`). **Reviewer:** Member E (billing/inventory peer reviewer). **Coordinator:** Member A (shared API/migrations). **UI & Reports Reviewer:** Member F.
**SRS:** `INV-01`–`04`, `PRE-01`–`06`, `REP-01`, `ADM-01`, `AUD-01`–`02`, `NFR-02`. **Acceptance targets:** `AT08`–`AT11`, `AT13`.
**Status:** Proposed for A, C, E, and F review on `member-d/task-set-06-inventory-contract`. This is a synthetic-development contract, not an implemented API, an approved clinic rule, or AT evidence. Implemented endpoints are added to [openapi.yaml](openapi.yaml) as each slice (`TASK-INV-01` through `TASK-INV-06`) is built and reviewed.

---

## 1. Architectural Rules & Data Invariants

1. **Fixed-Precision Decimal Grams (`NUMERIC(12, 3)`)**:
   - All botanical batch quantities, recipe base yields, recipe ingredient quantities, preparation target yields, snapshot quantities, and actual consumption quantities use fixed-precision **grams (`g`)** with **3 decimal places** (`0.001 g` / `1 mg`).
   - Stored in PostgreSQL as `NUMERIC(12, 3)`, computed in Go as exact 64-bit integer milligrams (`int64`), and serialized in JSON as canonical decimal strings with three fractional digits (e.g., `"50.000"`, `"3.333"`).
   - Binary floating-point (`float32`/`float64`) is strictly prohibited across handlers, services, repositories, and frontend helpers.
2. **Flat Recipes & Deterministic Scaling (`PRE-01`–`02`)**:
   - Recipes reference active `botanical_items` directly; nested or recursive recipes are rejected (`422 Unprocessable Entity`).
   - For a positive `targetYieldGrams`, each ingredient's snapshot requirement is calculated as:
     $$\text{required\_mg} = \text{round\_half\_up}\left(\frac{\text{base\_ingredient\_mg} \times \text{target\_yield\_mg}}{\text{base\_yield\_mg}}\right)$$
   - Rounding is applied once when saving the **Preparation Snapshot** (`SRS §15.1`).
3. **Immutable Preparation Snapshots & Zero Reservation/Deduction (`PRE-02`–`03`)**:
   - Saving a preparation creates rows in `preparations` (`status = 'prepared'`) and `preparation_snapshot_items`.
   - Saving a preparation **never reserves or deducts** batch stock.
   - Later edits to a recipe or deactivation of a botanical item do not alter any existing preparation snapshot.
4. **Batch Eligibility & Manual Selection (`INV-02`–`03`, `DEC03`)**:
   - No automatic FEFO or batch selection is performed; dispensary staff explicitly supply `allocations` (`batchId` + `quantityGrams`).
   - Expiry dates are stored as PostgreSQL `DATE` (`YYYY-MM-DD`) and evaluated against the current clinic date in **`Asia/Colombo`**.
   - A batch is `eligible` iff `blocked = false`, `expires_at IS NOT NULL`, `clinic_date_colombo <= expires_at`, and `remaining_grams > 0`.
   - Per the explicit SRS §8 gate rule, a batch with `expires_at IS NULL` has `unknown_expiry` status and **cannot be confirmed for consumption** or counted in consumable stock totals.
5. **Atomic Consumption, Lock Order & Idempotent Retries (`PRE-04`–`05`, `NFR-02`)**:
   - Confirmation (`POST /api/v1/preparations/{id}/confirm-consumption`) requires a client-generated UUID `operationId`.
   - Within a single PostgreSQL transaction:
     1. Acquire transaction-scoped advisory lock `pg_advisory_xact_lock` on the canonical `operationId` UUID.
     2. Check `consumption_operations` by `operation_id`: if already recorded with an identical payload fingerprint (`preparation_id` + canonical sorted `allocations`), return the original confirmed result (`200 OK`) with zero additional stock deduction; if recorded with a different payload fingerprint, return `409 Conflict`.
     3. Lock the target `preparations` row (`SELECT ... FOR UPDATE`) and verify `status = 'prepared'`. (If already `'consumed'` under a different `operationId`, return `409 Conflict`.)
     4. Load `preparation_snapshot_items` for the preparation.
     5. Lock all selected `stock_batches` rows in **ascending `id` order** (`SELECT ... FROM stock_batches WHERE id = ANY($1) ORDER BY id ASC FOR UPDATE`) to prevent deadlocks across competing confirmations.
     6. Re-verify that every selected batch exists, matches its snapshot `item_id`, is `eligible` (`!blocked`, `expires_at IS NOT NULL`, `clinic_date_colombo <= expires_at`), and has `remaining_grams >= requested_grams`, and that the sum of allocated quantities for each `item_id` **exactly equals** `required_grams` from the snapshot.
     7. Deduct `remaining_grams` on each batch, insert immutable `batch_consumptions` rows, update `preparations.status = 'consumed'`, insert `consumption_operations`, and write the transactional `preparation.consumed` audit event via `audit.Writer`.
   - Any validation, eligibility, sufficiency, or audit write failure rolls back the entire transaction.

---

## 2. Relational Schema Boundaries & Migration Sequence

Member D owns the inventory/preparation migrations. Coordinate exact sequence numbers with Member A against the latest `dev` (currently `000001`–`000009` are allocated):

| Proposed Migration | Tables & Triggers | Dependencies |
| --- | --- | --- |
| `000010_inventory_batches.up.sql` (`TASK-INV-01`) | `botanical_items`, `stock_batches` | `000001_foundation.up.sql` (`staff_accounts`, `audit_events`) |
| `000011_inventory_recipes_preparations.up.sql` (`TASK-INV-02`, `TASK-INV-03`) | `recipes`, `recipe_ingredients`, `preparations`, `preparation_snapshot_items`, immutability trigger on snapshot/consumed preparation | `000005_patients.up.sql` (`patients`), `000010_inventory_batches.up.sql` |
| `000012_inventory_consumptions.up.sql` (`TASK-INV-04`, `TASK-INV-05`) | `batch_consumptions`, `consumption_operations`, append-only immutability trigger on `batch_consumptions` | `000011_inventory_recipes_preparations.up.sql` |

### Table Definitions

| Table | Key Columns & Types | Constraints & Invariants |
| --- | --- | --- |
| `botanical_items` | `id uuid PK`, `code text UNIQUE`, `display_name text`, `base_unit text DEFAULT 'g'`, `active boolean DEFAULT true`, `deactivated_reason text`, `created_by uuid FK staff_accounts(id)`, `created_at timestamptz`, `updated_at timestamptz` | `base_unit = 'g'`; `length(btrim(code)) > 0`; `length(btrim(display_name)) > 0`. Deactivation retains historical references (`ADM-01`). |
| `stock_batches` | `id uuid PK`, `item_id uuid FK botanical_items(id) ON DELETE RESTRICT`, `batch_reference text UNIQUE`, `received_grams numeric(12,3)`, `remaining_grams numeric(12,3)`, `expires_at date NULL`, `blocked boolean DEFAULT false`, `block_reason text NULL`, `blocked_by uuid NULL FK staff_accounts(id)`, `blocked_at timestamptz NULL`, `received_by uuid FK staff_accounts(id)`, `received_at timestamptz` | `received_grams > 0`; `remaining_grams >= 0 AND remaining_grams <= received_grams`; `((NOT blocked AND block_reason IS NULL AND blocked_by IS NULL AND blocked_at IS NULL) OR (blocked AND length(btrim(block_reason)) > 0 AND blocked_by IS NOT NULL AND blocked_at IS NOT NULL))`. |
| `recipes` | `id uuid PK`, `code text UNIQUE`, `display_name text`, `base_yield_grams numeric(12,3)`, `active boolean DEFAULT true`, `version integer DEFAULT 1`, `created_by uuid FK staff_accounts(id)`, `created_at timestamptz`, `updated_at timestamptz` | `base_yield_grams > 0`; `version >= 1`. |
| `recipe_ingredients` | `id uuid PK`, `recipe_id uuid FK recipes(id) ON DELETE CASCADE`, `item_id uuid FK botanical_items(id) ON DELETE RESTRICT`, `quantity_grams numeric(12,3)` | `quantity_grams > 0`; `UNIQUE (recipe_id, item_id)`. Flat reference to `botanical_items` only (`PRE-01`). |
| `preparations` | `id uuid PK`, `patient_id uuid FK patients(id) ON DELETE RESTRICT`, `session_id uuid NOT NULL`, `recipe_id uuid FK recipes(id) ON DELETE RESTRICT`, `recipe_version integer NOT NULL`, `target_yield_grams numeric(12,3)`, `status text DEFAULT 'prepared'`, `prepared_by uuid FK staff_accounts(id)`, `prepared_at timestamptz`, `consumed_by uuid NULL FK staff_accounts(id)`, `consumed_at timestamptz NULL`, `operation_id uuid NULL UNIQUE` | `target_yield_grams > 0`; `status IN ('prepared', 'consumed')`; `((status = 'prepared' AND consumed_by IS NULL AND consumed_at IS NULL AND operation_id IS NULL) OR (status = 'consumed' AND consumed_by IS NOT NULL AND consumed_at IS NOT NULL AND operation_id IS NOT NULL))`. |
| `preparation_snapshot_items` | `id uuid PK`, `preparation_id uuid FK preparations(id) ON DELETE RESTRICT`, `item_id uuid FK botanical_items(id) ON DELETE RESTRICT`, `item_code text`, `item_display_name text`, `base_quantity_grams numeric(12,3)`, `required_grams numeric(12,3)` | `base_quantity_grams > 0`; `required_grams > 0`; `UNIQUE (preparation_id, item_id)`. Immutable once created (`PRE-02`). |
| `batch_consumptions` | `id uuid PK`, `preparation_id uuid FK preparations(id) ON DELETE RESTRICT`, `batch_id uuid FK stock_batches(id) ON DELETE RESTRICT`, `item_id uuid FK botanical_items(id) ON DELETE RESTRICT`, `quantity_grams numeric(12,3)`, `confirmed_by uuid FK staff_accounts(id)`, `confirmed_at timestamptz`, `operation_id uuid NOT NULL` | `quantity_grams > 0`; `UNIQUE (preparation_id, batch_id)`. Append-only; `ON DELETE RESTRICT` prevents hard-deleting referenced batches (`INV-04`). |
| `consumption_operations` | `operation_id uuid PK`, `preparation_id uuid NOT NULL FK preparations(id) ON DELETE RESTRICT`, `payload_sha256 text NOT NULL`, `confirmed_by uuid NOT NULL FK staff_accounts(id)`, `confirmed_at timestamptz NOT NULL` | Stores canonical SHA-256 fingerprint of `(preparation_id, sorted [{batch_id, quantity_mg}])` for idempotent retry verification (`PRE-05`). |

### Runtime Database Grants (`deploy/runtime-grants.sql`)
When migrations `000010`–`000012` are added, update [deploy/runtime-grants.sql](../../deploy/runtime-grants.sql) and [backend/db/runtime_grants_integration_test.go](../../backend/db/runtime_grants_integration_test.go):
- `GRANT SELECT, INSERT, UPDATE ON botanical_items, stock_batches, recipes, preparations TO :"app_role"`
- `GRANT SELECT, INSERT, DELETE ON recipe_ingredients TO :"app_role"` (allowing draft/recipe ingredient updates while preserving saved `preparation_snapshot_items`)
- `GRANT SELECT, INSERT ON preparation_snapshot_items, batch_consumptions, consumption_operations TO :"app_role"` (append-only at the database privilege level as well as trigger level)

---

## 3. Proposed `/api/v1` Endpoints

Every endpoint requires an active authenticated session (`RequireSession`), enforces CSRF (`X-CSRF-Token` + `Origin`) on unsafe methods, and checks active staff roles inside the database transaction (`FOR SHARE` on `staff_accounts`/`staff_roles`). Administrator role alone grants no clinical note access or dispensary consumption rights.

### 3.1 Botanical Items & Stock Batches (`TASK-INV-01`)

#### `POST /api/v1/inventory/items`
Registers a new botanical item.
- **Access:** `dispensary`, `administrator`
- **Audit Action:** `botanical_item.created`
- **Request Body:**
  ```json
  {
    "code": "BOT-ASHWA-001",
    "displayName": "Ashwagandha Root (Withania somnifera)"
  }
  ```
- **Response (`201 Created`):**
  ```json
  {
    "id": "10938471-2938-4819-9182-736451928374",
    "code": "BOT-ASHWA-001",
    "displayName": "Ashwagandha Root (Withania somnifera)",
    "baseUnit": "g",
    "active": true,
    "createdAt": "2026-10-31T08:30:00Z",
    "updatedAt": "2026-10-31T08:30:00Z"
  }
  ```

#### `GET /api/v1/inventory/items?activeOnly=true&limit=25&cursor=`
Lists botanical items ordered by `display_name ASC, id ASC`.
- **Access:** `dispensary`, `administrator`, `report_reader`, `clinician`
- **Response (`200 OK`):** `{ "items": [...], "nextCursor": null }`

#### `POST /api/v1/inventory/items/{itemId}/deactivate`
Deactivates a botanical item so it cannot be used in new batch receipts or recipes while preserving existing record displays (`ADM-01`).
- **Access:** `administrator`, `dispensary`
- **Audit Action:** `botanical_item.deactivated` (requires nonblank `reason`)
- **Request Body:** `{ "reason": "Replaced by standardized extract catalog entry" }`
- **Response (`200 OK`):** Updated botanical item with `"active": false`.

#### `POST /api/v1/inventory/batches`
Records a new botanical batch receipt in fixed-precision grams (`INV-01`).
- **Access:** `dispensary`
- **Audit Action:** `stock_batch.received`
- **Request Body:**
  ```json
  {
    "itemId": "10938471-2938-4819-9182-736451928374",
    "batchReference": "CLN-BATCH-2026-A01",
    "receivedGrams": "1000.000",
    "expiresAt": "2027-06-30"
  }
  ```
- **Response (`201 Created`):**
  ```json
  {
    "id": "b1111111-2222-4333-8444-555555555555",
    "itemId": "10938471-2938-4819-9182-736451928374",
    "itemCode": "BOT-ASHWA-001",
    "itemDisplayName": "Ashwagandha Root (Withania somnifera)",
    "batchReference": "CLN-BATCH-2026-A01",
    "receivedGrams": "1000.000",
    "remainingGrams": "1000.000",
    "expiresAt": "2027-06-30",
    "blocked": false,
    "blockReason": null,
    "eligibility": "eligible",
    "receivedBy": "d02c1c97-7588-4455-a045-127158e311f6",
    "receivedAt": "2026-10-31T08:35:00Z"
  }
  ```

#### `GET /api/v1/inventory/batches?itemId={uuid}&eligibleOnly=false&limit=25&cursor=`
Lists batches with real-time `eligibility` (`eligible`, `blocked`, `expired`, `unknown_expiry`, `depleted`) evaluated against the current `Asia/Colombo` date (`INV-02`–`03`).
- **Access:** `dispensary`, `report_reader`
- **Response (`200 OK`):** `{ "items": [...], "nextCursor": null }`

#### `POST /api/v1/inventory/batches/{batchId}/block`
Blocks a batch with a required reason (`INV-02`).
- **Access:** `dispensary`
- **Audit Action:** `stock_batch.blocked`
- **Request Body:**
  ```json
  {
    "reason": "Packaging seal damaged during transit"
  }
  ```
- **Response (`200 OK`):** Updated batch with `"blocked": true`, `"eligibility": "blocked"`, `"blockReason"`, `"blockedBy"`, `"blockedAt"`.

---

### 3.2 Flat Recipes & Preparation Snapshots (`TASK-INV-02` & `TASK-INV-03`)

#### `POST /api/v1/recipes`
Creates a flat recipe referencing active botanical items (`PRE-01`).
- **Access:** `dispensary`
- **Audit Action:** `recipe.created`
- **Request Body:**
  ```json
  {
    "code": "REC-ASHWA-GUDU-01",
    "displayName": "Synthetic Ashwagandha-Guduchi Decoction Mix",
    "baseYieldGrams": "100.000",
    "ingredients": [
      {
        "itemId": "10938471-2938-4819-9182-736451928374",
        "quantityGrams": "20.000"
      },
      {
        "itemId": "20938471-2938-4819-9182-736451928375",
        "quantityGrams": "15.000"
      }
    ]
  }
  ```
- **Response (`201 Created`):** Returns the recipe with `id`, `version: 1`, `baseYieldGrams`, and resolved ingredient array.

#### `PATCH /api/v1/recipes/{recipeId}`
Updates a flat recipe's `displayName`, `baseYieldGrams`, or `ingredients` with optimistic `version` check. Does not affect previously saved preparation snapshots (`PRE-02`).
- **Access:** `dispensary`
- **Audit Action:** `recipe.updated`
- **Response (`200 OK`):** Updated recipe with incremented `version` (`409 Conflict` on stale `version`).

#### `GET /api/v1/recipes?limit=25&cursor=` and `GET /api/v1/recipes/{recipeId}`
Reads flat recipes and their ingredients.
- **Access:** `dispensary`, `clinician`, `report_reader`

#### `POST /api/v1/preparations`
Scales a flat recipe to `targetYieldGrams` and saves an immutable preparation snapshot linked to `patientId` and `sessionId` with `status: "prepared"` (`PRE-02`–`03`). **No stock is reserved or deducted.**
- **Access:** `dispensary`
- **Audit Action:** `preparation.created`
- **Request Body:**
  ```json
  {
    "patientId": "30ad6d29-79b0-4028-93c4-614df48ec3ea",
    "sessionId": "88123910-1293-4819-9182-192837465001",
    "recipeId": "55123910-1293-4819-9182-192837465099",
    "targetYieldGrams": "250.000"
  }
  ```
- **Response (`201 Created`):**
  ```json
  {
    "id": "99123910-1293-4819-9182-192837465111",
    "patientId": "30ad6d29-79b0-4028-93c4-614df48ec3ea",
    "sessionId": "88123910-1293-4819-9182-192837465001",
    "recipeId": "55123910-1293-4819-9182-192837465099",
    "recipeVersion": 1,
    "targetYieldGrams": "250.000",
    "status": "prepared",
    "snapshot": [
      {
        "itemId": "10938471-2938-4819-9182-736451928374",
        "itemCode": "BOT-ASHWA-001",
        "itemDisplayName": "Ashwagandha Root (Withania somnifera)",
        "baseQuantityGrams": "20.000",
        "requiredGrams": "50.000"
      },
      {
        "itemId": "20938471-2938-4819-9182-736451928375",
        "itemCode": "BOT-GUDU-002",
        "itemDisplayName": "Guduchi Stem (Tinospora cordifolia)",
        "baseQuantityGrams": "15.000",
        "requiredGrams": "37.500"
      }
    ],
    "consumptions": [],
    "preparedBy": "d02c1c97-7588-4455-a045-127158e311f6",
    "preparedAt": "2026-10-31T08:40:00Z",
    "consumedBy": null,
    "consumedAt": null,
    "operationId": null
  }
  ```

#### `GET /api/v1/preparations?patientId=&sessionId=&status=&limit=25&cursor=` and `GET /api/v1/preparations/{preparationId}`
Retrieves preparation snapshots and their confirmation status.
- **Access:** `dispensary`

---

### 3.3 Manual Batch Allocation & Atomic Actual Consumption (`TASK-INV-04` & `TASK-INV-05`)

#### `POST /api/v1/preparations/{preparationId}/confirm-consumption`
Atomically validates manual batch selections against the saved snapshot, locks batches in `batch_id ASC` order, rechecks eligibility and sufficiency, deducts stock, records `batch_consumptions`, transitions `status` to `"consumed"`, and writes the `preparation.consumed` audit event (`PRE-04`–`05`).
- **Access:** `dispensary`
- **Audit Action:** `preparation.consumed`
- **Request Body:**
  ```json
  {
    "operationId": "7c4a1b9e-2001-4c9a-8a11-111111111111",
    "allocations": [
      {
        "batchId": "b1111111-2222-4333-8444-555555555555",
        "quantityGrams": "30.000"
      },
      {
        "batchId": "b2222222-2222-4333-8444-555555555556",
        "quantityGrams": "20.000"
      },
      {
        "batchId": "b3333333-2222-4333-8444-555555555557",
        "quantityGrams": "37.500"
      }
    ]
  }
  ```
- **Response (`200 OK` on initial confirmation and identical `operationId` retry):**
  Returns the updated preparation object with `"status": "consumed"`, `"operationId": "7c4a1b9e-2001-4c9a-8a11-111111111111"`, `"consumedBy"`, `"consumedAt"`, and populated `"consumptions"` array.
- **Failure & Conflict Responses:**
  - `409 Conflict` (`already_consumed`): Preparation was already confirmed under a different `operationId`.
  - `409 Conflict` (`operation_conflict`): `operationId` was already used with different material fields (`preparationId` or `allocations`).
  - `409 Conflict` (`batch_ineligible` / `insufficient_stock`): Selected batch is blocked, expired, has `expiresAt == null`, or has `remainingGrams < quantityGrams`.
  - `422 Unprocessable Entity` (`validation_failed`): Batch item does not belong to the snapshot, or allocated quantities per ingredient do not sum to the snapshot's `requiredGrams`.

---

### 3.4 Bidirectional Traceability & Stock Reports (`TASK-INV-06` & `TASK-QA-02`)

#### `GET /api/v1/reports/inventory/traceability/batches/{batchId}`
Forward traceability: lists all actual recipients (`patientId`, `patientDisplayName`, `sessionId`, `preparationId`, `quantityGrams`, `confirmedBy`, `confirmedAt`) for a stock batch (`PRE-06`, `REP-01`, `AT11`).
- **Access:** `dispensary`, `report_reader`

#### `GET /api/v1/reports/inventory/traceability/patients/{patientId}`
Reverse traceability: lists all actual consumed batches and quantities for a patient (`PRE-06`, `REP-01`, `AT11`). Saved preparations still in `"prepared"` status are **excluded** from actual consumption history.
- **Access:** `dispensary`, `report_reader`, and assigned `clinician` (enforced via patient assignment check when called by a clinician). Never returns clinical consultation note text.

#### `GET /api/v1/reports/inventory/stock?itemId=`
Stock availability report (`REP-01`): returns per-item totals separating `consumableGrams` (from eligible batches) from `blockedGrams`, `expiredGrams`, and `unknownExpiryGrams`, along with applied filter metadata and batch breakdown.
- **Access:** `dispensary`, `report_reader`

---

## 4. Cross-Module Integration & Review Handoff

1. **Member B (Patients & Clinical)**:
   - `preparations.patient_id` references `patients(id)` (`000005_patients.up.sql`).
   - Dispensary and report endpoints return only minimum patient identity (`id`, `displayName`) and never join or expose `consultations` or `consultation_addenda` (`IAM-04`).
2. **Member C (Scheduling & Therapy Sessions)**:
   - `preparations.session_id` links each preparation to the patient's scheduled therapy session (`SRS §9`, `§13`).
   - Once C's `sessions` migration is merged to `dev`, D/C will add a follow-up foreign key verifying that `preparations.session_id` exists in `sessions(id)` and belongs to the same `patient_id`.
3. **Member E (Invoicing & Receipts — Peer Reviewer)**:
   - D and E use the same `pg_advisory_xact_lock` + `operation_id` payload-fingerprint retry pattern (`PRE-05` and `BIL-05`). E reviews D's multi-batch lock ordering and rollback tests (`TASK-INV-04`–`05`, `TASK-INV-08`); D reviews E's receipt concurrency and retry tests (`TASK-BILL-04`, `TASK-BILL-06`).
4. **Member F (Frontend & Reports Integration)**:
   - Inventory screens (`TASK-UI-04`, `TASK-INV-07`) must visually separate **Prepared (No Stock Deducted)** from **Consumed (Stock Deducted)** and display batch eligibility badges (`Eligible`, `Blocked`, `Expired`, `Unknown Expiry`) without offering FEFO or stock-reservation controls.

| Reviewer / handoff | Status | Outcome/date/evidence |
| --- | --- | --- |
| A — shared API conventions, RBAC/audit alignment, migration numbers `000010`–`000012`, `runtime-grants.sql` | Pending | — |
| E — peer review of schema, `NUMERIC(12,3)` math, `batch_id ASC` locking, and `operationId` retry contract | Pending | — |
| C — `preparations.session_id` linkage and same-patient session check | Pending | — |
| F — `TASK-UI-04` screen states, `fieldErrors` handling, and `REP-01` report navigation | Pending | — |
| Clinic dispensary reviewer — `DEC03` recipes, scale/rounding, and expiry confirmation | Pending | See [inventory-rules-review.md](../inventory-rules-review.md) |
