# QA-02 report-access review — 17 November 2026

TASK-QA-02: Member A checks access, F owns report navigation, D/E own their report behavior. Reviewer F with D/E module review. SRS IAM-03/04, REP-01, PRE-06 and BIL-06; AT11/AT13 evidence support. Baseline `b7f949278af671659548f495f070ebcdf95e350e`, including merged report navigation #80, accessibility #90 and shared patterns #81. Synthetic data only. DEC02/03/04/05/07 and independent reviewer acceptance retain their gates.

## Implemented policy under review

The table records current module behavior for verification, not a new production permission decision. All report HTTP routes use the shared session middleware, reject anonymous requests and send `Cache-Control: no-store`. Services recheck active staff roles in their database transaction. Direct requests remain protected even when a navigation link is hidden.

| Read | Current permitted roles and scope |
| --- | --- |
| Billing outstanding report | `billing`, `report_reader`; clinic-wide issued invoices with a positive committed balance. Draft and fully settled invoices are excluded. |
| Stock batches/summary | `dispensary`, `report_reader`; server-side item, eligibility and cursor/limit filters. Summary categories respect the item filter and intentionally describe all stock categories, independently of pagination and eligible-only row filtering. |
| Batch consumption trace | `dispensary`, `report_reader`; exact batch ID, committed consumption only. |
| Patient consumption trace | `dispensary`, `report_reader`, or an active clinician explicitly assigned to that patient. Revoked/missing assignments deny clinician access. |
| Invoice detail, list, balance and receipt history | `billing`, `receptionist`; report-reader permission alone does not grant these reads. |

Administrator alone, reception, therapist and clinician alone do not gain global billing/stock/batch-report permission. A mixed clinician/report-reader account retains the explicitly granted report role; the billing report screen remains read only. Existing module rules permit identifiable inventory trace data to report readers, including patient display name. DEC02/05 and owner/clinic review must approve that scope before real data is used.

The billing report returns only `generatedAt` and rows containing `invoiceId`, `patientId`, `issuedAt`, `totalMinor`, `paidMinor`, `outstandingMinor`, `ageDays`. No patient demographics, line descriptions, receipt labels, clinical bodies or session secrets appear. The trace projection is limited to `patientId`, `patientDisplayName`, `sessionId`, `preparationId`, `batchId`, `batchReference`, `quantityGrams`, `confirmedBy`, `confirmedAt`; hidden address/observation canaries must not appear.

## Added executable checks

`backend/internal/inventory/qa02_integration_test.go` uses real migrated PostgreSQL and module services. Two synthetic patients/sessions, separate items/batches and actual confirmed consumptions prove that each trace ID isolates its records; saved but unconsumed preparations do not appear. Tests cover the role matrix, assigned/unassigned clinician behavior, revoked assignment, disabled reader, exact serialized field allowlist and private-text exclusion. Stock checks cover item isolation, eligible/blocked/expired/unknown categories, four-page cursor traversal without duplicate/lost rows, item-scoped totals and an unchanged batch after a denied reader mutation.

`frontend/tests/fullstack/qa02-reports.spec.ts` extends the existing isolated HTTPS → Next → Go → PostgreSQL suite without API interception. Four cases cover anonymous/all seven single-role direct report boundaries; allowed report-only field projection and draft/settled exclusion; real CSRF-authenticated reader mutation denials with unchanged invoice/list/receipts; and single-role/mixed-role browser navigation, refresh and reload with no invoice mutation controls. This complements F's simulated-response navigation regressions rather than treating those as backend permission proof.

Run the focused database checks with `go test -tags=integration -run '^TestQA02' -count=1 -v ./internal/inventory` in `backend`, using a disposable `TEST_DATABASE_URL`. Follow [fullstack setup](../../frontend/tests/fullstack/README.md), then run `npm run test:fullstack -- qa02-reports.spec.ts` in `frontend`. The existing CI integration and auth-browser jobs automatically discover the new files. Traces/screenshots/video remain disabled; assertions compare booleans/field names instead of printing credentials or private text.

## Execution and acceptance

17 November 2026, Codex-authored automation, Windows, Go 1.27.4 and Node 22.23.4. Used an isolated checkout and a newly created disposable Neon database; public deployment data was not changed. Both PostgreSQL tests passed: trace access/projection in 36.06 seconds and stock filters/read-only role in 13.13 seconds. Fixture schemas and the disposable database were removed. Local integration compilation, focused Go vet, frontend type-check and focused ESLint passed. The initial frontend attempt lacked local dependencies; reusing existing installed dependencies in the isolated checkout resolved that setup issue. No dependency versions or runtime behavior changed.

The new real fullstack cases require execution in the branch's auth-browser CI job; their result must be recorded separately before they count as passed. Full QA-02/AT11/AT13 acceptance remains in progress pending F/D/E review, policy decisions and the handoffs below. No production endpoint, schema, permission or OpenAPI publication changed in this review slice.

## Handoffs and limits

- D/F: report-reader navigation currently exposes billing reports. Inventory API report reads exist, but the shared `/inventory` area is dispensary-only and its workspace contains write controls. A dedicated reviewed read-only inventory report entry is a remaining UI handoff; do not widen the area guard to expose the existing mutation workspace.
- D: trace results are capped at the newest 100 rows with no cursor. These checks prove exact record filtering at the tested size, not exhaustive large-history export. Confirm the accepted completeness/pagination contract before closing AT11.
- E/F: the current outstanding report is global for its permitted roles and has no server-side patient/date filter or export contract. Do not present client-side filtering or an added URL parameter as a narrower backend permission boundary. A bounded/paginated report remains a shared contract/performance review item.
- A/F/D/E: review the recorded fields, clinician assignment behavior and report-reader identity exposure. This implementation-level verification is not clinic approval or DEC05 real-data authorization.
