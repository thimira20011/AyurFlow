# QA-04 permission and audit review

Member A owns TASK-QA-04 with F as the designated reviewer. Scheduling changes also require C/B review, inventory tests D/E review, and billing tests E/D review. Requirements are IAM-03/04 and AUD-01/02 with AT13, plus scheduling and inventory record-access checks supporting AT06/07/11. This review uses synthetic fixtures against the merged `dev` baseline `f503c7b`, dated 10 November 2026. DEC02/03/04/05/07/08 and independent reviewer acceptance retain their recorded gates.

## Finding and correction

QA04-01 concerns reception access to therapist observations. The scheduling list correctly restricts therapists to assigned sessions and clinicians to assigned patients. Its shared response model also included the stored `observations` field when reception listed sessions. Reception's booking access therefore exposed clinical delivery text. The correction clears that field in the reception response projection. Assigned therapists and clinicians retain their permitted observation access. Saved clinical history remains available in PostgreSQL.

The regression completes a real synthetic session, checks reception's serialized response, verifies assigned and unassigned clinician/therapist results, denies administrator-only, dispensary, billing and report-reader accounts, rejects a disabled therapist, and independently checks that the stored observation is preserved. C/B must review this correction with A/F.

## Transaction and permission coverage

| Area | Reviewed implementation and executable evidence |
| --- | --- |
| HTTP boundary | All registered business groups use `RequireSession`. It enforces cookie authentication, CSRF and Origin on writes, rejects cross-site requests and sends `Cache-Control: no-store`. Services recheck active accounts and roles in their transaction. Existing protected HTTP/fullstack suites exercise direct denials. |
| Clinical and patients | Shared authorizer requires explicit clinician assignment and denies administrator-only note access. Existing patient, assignment, draft, sign and addendum tests force audit failure and inspect rollback. |
| Scheduling | QA04-01 adds the role/record observation matrix. New database-trigger tests force failures during room creation, availability change, booking, rescheduling, start, completion and cancellation. Each requires PostgreSQL error `P0001` from the rejecting audit trigger and compares the full saved room/availability/session/audit snapshot. |
| Inventory | Existing cases check unauthorized roles, batch retention, snapshot immutability, consumption races/retries and traceability restrictions. New database-trigger tests cover item deactivation, batch receipt/block, recipe create/update, snapshot save and consumption. They compare stock, ingredients, preparations, snapshot rows, consumption rows, retry operations and audit history. |
| Billing | Existing tests cover receipt audit rollback, role denial, disabled accounts, issued-history protection and retry/concurrency. New database-trigger tests cover invoice creation, line add/remove, issue and void with unchanged invoice/item/receipt/audit snapshots. |
| Audit storage | Existing tests reject ordinary UPDATE/DELETE/TRUNCATE, enforce metadata constraints and require an explicit object-access adapter for retrieval. The router exposes no generic audit reader. |

The new trigger checks require the failing audit write to be reached. A validation or permission rejection alone cannot satisfy the rollback assertion. CI supplies real isolated PostgreSQL fixtures with race detection and rejects skipped integration cases.

## Open findings and acceptance work

- QA04-02 belongs to E/A schema coordination. The merged invoice schema accepts a patient UUID without a patient foreign key. Existing billing fixtures explicitly rely on that gap. E should supply a forward migration with a reviewed treatment for existing orphan references. The new invoice tests use a real synthetic patient.
- QA04-03 belongs to E. Billing read methods acquire a transaction for authorization but perform several repository reads through the pool, including `GetInvoice`, invoice items and outstanding reports. A saturated pool can stall those reads while authorization transactions occupy its connections. This is a source finding requiring a focused reproduction and owner fix.
- Final role and report/export policies still need the recorded decision and owner reviews. QA-02 retains the report-specific access review. Clinic approval and reviewer signatures must be recorded separately.
- AT13 requires execution/version evidence and an independent review across the complete critical-action matrix. These focused regressions extend that evidence. Remaining manual scenarios and unresolved findings keep the parent task in progress.

## Execution

The original working checkout still contains prior OPS-04 changes. Terminal fetching failed, so the current backend was assembled in ignored `.cache/qa04/` from the pinned GitHub source and reviewed there. Local integration compilation and focused vet checks passed. Docker is unavailable locally, so PostgreSQL execution is delegated to the branch's existing CI integration job. The runtime privacy change, new tests and this review record are submitted together on `codex/qa-04-permissions-audit`. Record the final CI run and its outcomes here after execution.

Codex automation executed the new PostgreSQL tests on 10 November 2026 at `b9243d0` in [project-check run 42758956484](https://github.com/thimira20011/AyurFlow/actions/runs/42758956484). The integration job passed with PostgreSQL 17.11, Go 1.27.3, race detection and skipped-test rejection. All 19 new mutation rollback cases reached the rejecting audit trigger and preserved the compared records. The five named visibility cases passed, together with administrator/dispensary/billing/report-reader denial, disabled-account denial and the stored-history assertion. Expected and actual results matched. Existing patient/clinical/account/audit and receipt suites ran in the same integration job. The redacted `postgres-integration-results` artifact provides the per-case outcomes.

Local unit tests passed outside `cmd/api`. Its two shutdown tests initially failed to start their loopback handlers under restricted execution. A permitted rerun of `go test -count=1 ./cmd/api` with local network access passed. Focused integration compilation and vet passed for scheduling, inventory and billing. Review of public Render deployment behavior and independent module-owner/F acceptance remain pending. The source findings QA04-02 and QA04-03 retain their owner follow-ups.

