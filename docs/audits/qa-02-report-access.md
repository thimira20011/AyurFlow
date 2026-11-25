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

Corrected implementation `97dfc5cddf08d3cdc680b3074be366f603856c06` passed all seven [project-check jobs in run 44046418976](https://github.com/thimira20011/AyurFlow/actions/runs/44046418976) and the [clean-start job in run 44046419235](https://github.com/thimira20011/AyurFlow/actions/runs/44046419235). Environment: Linux CI, Go 1.27.4, Node 22.23.2, PostgreSQL 17.11 and Playwright 1.64.1/Chromium. PostgreSQL integration ran with race detection and skipped-test rejection. Both new database checks passed. The frontend job passed all 43 simulated-response browser checks; the real fullstack job passed all 23 cases, including the four new QA-02 cases. Tester: Codex-authored automation executed by GitHub Actions on 17 November 2026, new fullstack cases completed at 13:58 Asia/Colombo (08:28 UTC). Safe case results are retained in the existing auth-browser-results artifact.

| New real fullstack case / expected behavior | Actual |
| --- | --- |
| Anonymous reports 401; seven single-role accounts follow the documented report matrix; all responses no-store | Passed |
| Outstanding rows exclude draft/settled records and contain only the seven allowed fields; no private fixture text | Passed |
| Reader invoice reads/writes denied (403), patient detail concealed (404/not_found); invoice, list and receipts unchanged | Passed |
| Single-role report reader uses actual workspace/report navigation, refresh and reload without invoice controls | Passed |
| Clinician/report-reader mixed account retains a read-only billing report screen after reload | Passed |

The second executable case covers both projection and denied writes, so the five expectation rows above correspond to four Playwright cases. Full QA-02/AT11/AT13 acceptance remains in progress pending F/D/E review, policy decisions and the handoffs below. No production endpoint, schema, permission or OpenAPI publication changed in this review slice.

Initial [CI run 44045591552](https://github.com/thimira20011/AyurFlow/actions/runs/44045591552) passed the two PostgreSQL regressions and three of four new fullstack cases. The projection case initially expected 403 for a forbidden patient detail; the existing handler intentionally conceals it as 404/`not_found`. The corrected assertion requires that exact response and handles the API's existing null representation of an empty receipt list. The frontend job also exposed a pre-existing accessibility-test race: Tab was pressed while the staff-create button was disabled during asynchronous loading. The test now waits for that button to become enabled before tabbing; its focus/outline assertions remain intact. A local production-build attempt was blocked by Turbopack rejecting the isolated checkout's dependency junction; Linux CI built/type-checked successfully. The corrected CI results above supersede these failed attempts without representing them as passes.

## Handoffs and limits

- The 26 November follow-up adds a dedicated read-only inventory report for `report_reader` and `dispensary`, with the existing stock totals, batch eligibility filter and cursor, and confirmed-use trace in both directions. The existing `/inventory` workspace remains restricted to dispensary. See the [report instructions](../../frontend/src/features/inventory/README.md#task-qa-02-read-only-inventory-report). D/F review and acceptance remain open.
- D: trace results are capped at the newest 100 rows with no cursor. These checks prove exact record filtering at the tested size, not exhaustive large-history export. Confirm the accepted completeness/pagination contract before closing AT11.
- E/F: the current outstanding report is global for its permitted roles and has no server-side patient/date filter or export contract. Do not present client-side filtering or an added URL parameter as a narrower backend permission boundary. A bounded/paginated report remains a shared contract/performance review item.
- A/F/D/E: review the recorded fields, clinician assignment behavior and report-reader identity exposure. This implementation-level verification is not clinic approval or DEC05 real-data authorization.

## 26 November inventory report verification

The [full-stack job](https://github.com/thimira20011/AyurFlow/actions/runs/45685744952/job/139457778581) passed all 25 cases on `e731b2c` using the real HTTPS proxy, Next.js, Go and disposable PostgreSQL 17.11. It verified both single- and mixed-role navigation, dispensary-only access to `/inventory`, and read-only report access after reload. A report reader saw the newly received synthetic batch at 15.125 g and received an empty confirmed-use result for that batch. Simulated-response UI tests additionally check server-side pagination and filtering, display of confirmed trace rows, and omission of the stock block reason.
