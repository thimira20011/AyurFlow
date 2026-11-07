# Inventory and preparation UI

Owner: Member D (`K. I. R. Perera`) with Member F. Reviewer: Member E / Member A. SRS: `INV-01`–`04`, `PRE-01`–`06`, `REP-01`.

## Implemented in `TASK-UI-04` & `TASK-INV-01`

- [`inventory-workspace.tsx`](inventory-workspace.tsx) and [`inventory-workspace.module.css`](inventory-workspace.module.css):
  - **Screen 01 (`AT08` — Connected to live `/api/v1/inventory/*` in `/inventory`)**: Botanical item registration (`POST /api/v1/inventory/items`), item deactivation (`POST /api/v1/inventory/items/:itemId/deactivate`), batch receipt in fixed-precision grams (`POST /api/v1/inventory/batches`), batch blocking with mandatory reason (`POST /api/v1/inventory/batches/:batchId/block`), and manual selection batch registry (`GET /api/v1/inventory/batches`) showing `Eligible`, `Blocked · Ineligible`, `Expired · Ineligible`, and `Unknown Expiry · Not Consumable` badges alongside summary totals evaluated in `Asia/Colombo`.
  - **Screens 02–04 (`AT09`–`AT11` — Interactive wireframes awaiting `TASK-INV-02`–`06` backend slices)**: Flat recipe scaling preview (`0.001 g` Round Half Up), side-by-side comparison of **Prepared (`No Stock Deducted`)** vs. **Consumed (`Stock Deducted`)** states, and bidirectional **Batch → Patients** / **Patient → Batches** traceability views.
- Protected route [`/inventory`](../../app/inventory/page.tsx) wrapped in `HeritageShell` (`section="Inventory"`), plus development preview route [`/inventory/preview`](../../app/inventory/preview/page.tsx).
