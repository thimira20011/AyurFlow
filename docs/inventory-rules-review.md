# Botanical inventory, recipes and consumption rules review — DEC03

This is the review record for Member D (`TASK-SET-03` and `TASK-INV-01` through `TASK-INV-08`; clinic dispensary reviewer and Member E peer reviewer). It translates the open botanical inventory, recipe scaling, batch eligibility, and discrepancy decisions in SRS v1.0 (`INV-01`–`04`, `PRE-01`–`06`, `REP-01`, `DEC03`) into concrete questions for review and signoff, alongside the provisional rules used for synthetic development. **No clinic-specific answer or real dispensary approval is recorded yet.** The rules below establish the SRS baseline and synthetic development invariants; they do not substitute for clinic signoff. Keep [decisions.md](decisions.md) marked pending until the relevant reviewers approve a dated answer.

## Review record

| Item | Value to record |
| --- | --- |
| Project and institution | AyurFlow — Group 04, IS5109 Community Project; Sabaragamuwa University of Sri Lanka, Faculty of Computing, Department of Computing and Information Systems (SRS v1.0 document control) |
| Clinic dispensary reviewer name and role | Pending clinic appointment |
| Team Member D name | K. I. R. Perera (`22FIS0506`) — Inventory and Preparation |
| Peer reviewer (Member E) | Member E (Invoicing and Receipts) |
| Review date and SRS version | Pending; SRS v1.0 is the current review baseline |
| Evidence location (signed notes, recipe cards, batch log samples) | Pending; store approved evidence in the team's agreed location |
| Outcome | Pending — approved, approved with conditions, or returned for revision |

Do not put real patient records, proprietary clinic formulas not approved for synthetic demonstration, or credentials in this repository. Record the approved rules and a reference to review evidence here.

## Working rules for development

The current user has directed inventory and preparation work to proceed with synthetic data. The rules in this section represent the **provisional development contract**, not final clinic answers. They allow the database schema, Go service logic, transactional audit, and Next.js interface to be built and verified against `AT08`–`AT11`. The open questions and gates below remain active for inventory UAT and any real-data pilot.

| Topic | Interim rule for synthetic development | Open gate and accountable owner |
| --- | --- | --- |
| Base unit & fixed precision | Store and calculate all botanical batch and recipe quantities in fixed-precision **grams (`g`)** with **3 decimal places** (`NUMERIC(12, 3)` in PostgreSQL, exact integer milligrams `1 mg = 0.001 g` in Go `int64`, and canonical decimal strings such as `"50.000"` in JSON). Binary floating-point (`float32`/`float64`) is strictly prohibited. All received, base-yield, ingredient, target-yield, and consumed quantities must be strictly positive (`> 0`). Remaining batch quantity must never be negative (`>= 0`). | D and clinic dispensary staff confirm whether milligram (`0.001 g`) precision and gram conversions cover all pilot raw botanicals before inventory UAT (`DEC03`). |
| Recipe scaling & rounding | Recipes are strictly **flat** (referencing active botanical items directly; no nested/recursive recipes). For a positive `target_yield_grams`, each ingredient scales as $\text{scaled\_grams} = \text{round}(\text{base\_ingredient\_grams} \times \text{target\_yield\_grams} \div \text{base\_yield\_grams}, 3)$ using deterministic **Round Half Up** (`0.0005 g` rounds to `0.001 g`). Rounding is applied when saving the **Preparation Snapshot** (`PRE-02`, `SRS §15.1`). | D and clinic dispensary staff review rounding behavior and example yields before inventory UAT (`DEC03`). |
| Immutable preparation snapshot & no deduction | Saving a preparation records the `patient_id`, `session_id`, `recipe_id`, `target_yield_grams`, and the scaled ingredient snapshot with `status = 'prepared'`. Later recipe edits or item deactivations never alter a saved preparation snapshot (`PRE-02`). Saving a preparation **neither reserves nor deducts stock** (`PRE-03`). | D and E review snapshot schema and immutability checks before `TASK-INV-03` acceptance. |
| Expiry inclusivity & missing expiry | Batch expiry is stored as a PostgreSQL `DATE` (`YYYY-MM-DD`) and evaluated against the current clinic date in **`Asia/Colombo`**. A batch is **eligible through the end of its expiry date** (`clinic_date_colombo <= expires_at`) and **expired after** (`clinic_date_colombo > expires_at`). Under the explicit SRS §8 gate rule, a batch with `expires_at IS NULL` has `unknown` eligibility and **shall not be consumable**; no automatic expiry estimate is permitted. | D and clinic dispensary staff confirm inclusive expiry and whether missing expiry dates are prohibited at receipt or stored as non-consumable until verified (`DEC03`). |
| Batch blocking & eligibility recheck | Authorised `dispensary` staff may block an active batch with a required nonblank reason (recording a transactional `batch.blocked` audit event). Staff manually select batches for consumption; no automatic FEFO selection exists (`INV-03`). At consumption confirmation (`PRE-04`), the backend locks all selected batches in ascending `batch_id` order (`FOR UPDATE`), rechecks that each batch belongs to the snapshot botanical item, is not blocked, has a known non-expired `expires_at`, and has `remaining_grams >= requested_grams`. | D and E review lock ordering and rollback semantics (`TASK-INV-04`, `AT10`). |
| Atomic consumption & retry safety | Selected batch quantities per ingredient must sum **exactly** to that ingredient's saved snapshot quantity (`PRE-04`, `SRS §15.1`). Confirmation deducts `remaining_grams`, inserts immutable `batch_consumptions` rows, transitions the preparation to `consumed`, records the canonical UUID `operation_id` and payload fingerprint, and writes the `preparation.consumed` audit event in one PostgreSQL transaction (`PRE-04`–`05`). Repeating the same `operation_id` with identical material content returns the original result without re-deducting; reusing the same `operation_id` with changed content returns `409 Conflict`. A preparation can be confirmed at most once. | D, E, and A align `operation_id` fingerprint and advisory-lock semantics under `DEC07` and `TASK-INV-05`. |
| Role & record permissions | Enforced in backend transactions with `RequireSession` + CSRF protection on mutations. `dispensary` staff manage botanical items, batch receipts, batch blocks, flat recipes, preparations, manual batch selection, consumption confirmation, and traceability lookups. `report_reader` may read authorised stock availability and traceability reports (`REP-01`). `administrator` may deactivate unconsumed reference entries (`ADM-01`) but has no clinical note access. Dispensary and report views expose only the minimum patient/session identifiers needed for preparation and traceability, never clinical consultation notes (`IAM-04`, `SRS §2`). | D, A, and B verify minimum patient/session identifier projection and role checks (`AT01`, `AT11`, `AT13`). |
| History retention & external discrepancies | Batches referenced by any consumption record cannot be hard-deleted (`INV-04`). Confirmed consumption records are append-only and immutable. Physical stock adjustments, waste, spillage, moisture decay, and supplier returns are excluded from this pilot release (`SRS §1.2`, `§8`, `§15.4`) and must not be simulated by editing confirmed history. | D and clinic dispensary reviewer document the external paper/register procedure for physical stock discrepancies before inventory UAT (`DEC03`). |

## DEC03 — dispensary, recipe and inventory questions (before inventory UAT)

| Question for clinic dispensary reviewer and Member D | Recorded rule / example |
| --- | --- |
| What raw botanical items and standard flat recipes should be included in the pilot catalog, and how are traditional weight units (e.g. kalanda, palama, or kilograms) converted into grams prior to entry? | Synthetic catalog established in [tests/fixtures/member-d-cases.json](../tests/fixtures/member-d-cases.json) using standard gram values (e.g., Ashwagandha Churna base recipe `100.000 g` yield; Dashamoola Kwatha base recipe `300.000 g` yield). Official clinic conversion table and recipe signoff pending. |
| What decimal scale and rounding rule apply when scaling a recipe to a patient/session target yield? | Provisional rule: `NUMERIC(12, 3)` (`0.001 g` scale) with Round Half Up applied at preparation snapshot creation (`20.000 g` at `100.000 g` base yield → `50.000 g` at `250.000 g` target yield; `10.000 g` at `300.000 g` base yield → `3.333 g` at `100.000 g` target yield). Clinic confirmation pending. |
| Is a batch expiry date inclusive of the printed date in `Asia/Colombo` time, and how should staff record a delivery that arrives without a printed expiry date? | Provisional rule: Inclusive of `expires_at` in `Asia/Colombo` (`clinic_date <= expires_at`). Batches with `expires_at IS NULL` are flagged as `unknown` eligibility and blocked from consumption confirmation and consumable stock totals until a verified expiry is recorded or policy is approved (`SRS §8`). |
| What reasons are required when blocking a batch (e.g. contamination, damaged seal, supplier recall, quality hold), and can a blocked batch be unblocked or only replaced? | Provisional rule: Nonblank reason required on block (audited in `audit_events`); blocked batches are immediately excluded from consumable stock and rejected at consumption confirmation. Clinic confirmation of unblock authority pending. |
| Which patient and session fields must dispensary staff see on the preparation and traceability screens to prepare and verify remedies safely without viewing clinical notes? | Provisional rule: Patient internal ID, display name, session ID, scheduled session interval, and care-plan stage label; clinical consultation notes and addenda remain strictly inaccessible (`403 Forbidden`). |
| How will the clinic record and reconcile physical stock discrepancies (evaporation/moisture loss, preparation spillage, expired-stock disposal, or supplier returns) outside the application during the pilot? | Provisional rule: Application preserves immutable receipt and consumption history (`SRS §15.4`). When a physical batch is exhausted early or spoiled, dispensary staff block the batch with a reason referencing the clinic's physical discrepancy register. Formal clinic procedure signoff pending. |

## Examples to review before approval

Use synthetic records only. Detailed test cases and expected assertions are listed in [docs/qa/member-d-examples.md](qa/member-d-examples.md) and [tests/fixtures/member-d-cases.json](../tests/fixtures/member-d-cases.json).

| Example | SRS baseline expected result | Clinic detail still needed |
| --- | --- | --- |
| Receive a botanical batch with positive grams (`1000.000 g`) vs. zero/negative grams. | Positive receipt succeeds with `remaining_grams = received_grams` and audit event; zero or negative quantity is rejected (`422`). | Allowed clinic batch reference format and supplier fields. |
| Block an active batch or let a batch pass its expiry date before confirming consumption. | Batch is excluded from consumable totals; selecting it at confirmation is rejected (`409`) even if it was eligible when the screen opened (`INV-02`). | Block reason categories and missing-expiry policy. |
| Scale a flat recipe (`20.000 g` at `100.000 g` yield) to `250.000 g` target yield, then edit the recipe. | Preparation saves `"50.000"` g snapshot with zero stock deduction; subsequent recipe edits leave the saved snapshot unchanged (`AT09`). | Approved recipe catalog and rounding confirmation. |
| Confirm consumption of `"50.000"` g split across two eligible batches (`"30.000"` g + `"20.000"` g), then retry with the same `operationId`. | Both batches deduct atomically once; identical retry returns original result with no second deduction; changed payload with same `operationId` conflicts (`409`). | None (core SRS `PRE-04`–`05` invariant). |
| Confirm consumption when one selected batch in a multi-batch request is insufficient, blocked, expired, or mismatched. | Entire transaction rolls back; no batch is deducted and preparation remains `prepared` (`AT10`). | None (core SRS `PRE-05` invariant). |
| Trace a consumed batch forward to patients/sessions and a patient backward to consumed batches. | Returns all confirmed consumptions and quantities; unconsumed (`prepared`) preparations are excluded from consumption history (`AT11`). | Permitted report filter fields and role access confirmation. |

## Closure and handoff

| Decision | Current state | Needed to close |
| --- | --- | --- |
| DEC03 | Pending clinic dispensary confirmation | Signed-off recipe examples, unit conversion table, decimal scale/rounding confirmation, expiry inclusivity/missing-expiry rule, and external discrepancy procedure |

Before marking `DEC03` closed for inventory UAT, record dated answers and clinic evidence above, obtain the clinic dispensary reviewer's signoff, and update [decisions.md](decisions.md). Give A the agreed migration sequence and runtime grants, E the shared retry/transaction conventions for peer review, and F the screen states (`Prepared` vs `Consumed`, batch eligibility badges, and traceability filters) for `TASK-UI-04` and `TASK-QA-02`.

| Handoff | Recipient/date | Reviewed evidence |
| --- | --- | --- |
| Inventory/preparation logical schema, fixed-precision gram representation, and `operationId` retry contract | A & E — pending review on `member-d/task-set-03-inventory-rules` | Pending |
| Batch eligibility states, `Prepared` vs `Consumed` visual distinction, and traceability wireframes (`TASK-UI-04`) | F — pending | Pending |
| Synthetic `AT08`–`AT11` test cases and fixtures (`TASK-QA-01`) | E & F — [docs/qa/member-d-examples.md](qa/member-d-examples.md) | Pending |

Sources: AyurFlow Software Requirements Specification v1.0, sections 2, 8, 9, 11–18; AyurFlow Team Task Plan, `TASK-SET-03`, `TASK-SET-06`, `TASK-UI-04`, `TASK-INV-01`–`08`, and Member D ownership.
