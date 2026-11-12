# Member C step-by-step task list

Prepared 12 November 2026. The current user confirmed they are **Member C**; personal name is pending. Target: end of November 2026 (provisional; confirm the exact submission date and assessment requirements). C owns scheduling and therapist delivery; **B reviews C**, and C reviews B's patient/clinical work. A supports shared security/contracts, D owns preparation evidence, and F supports shared UI and integration.

This is an execution checklist, not an acceptance claim. Unchecked items require verification even where code exists. Do not attribute existing code to C without contribution evidence. Record your own reviews, fixes, tests and documentation.

## Branch, PR and completion policy

- Create a separate task-focused branch for each change set; push it and open a PR targeting `dev` when access permits.
- All required tests must pass before merging into `dev`. Skipped or unavailable tests do not count as passed. Leave PRs open for review; do not bypass failing checks.
- Tick completed checklist items with evidence. Mark a full task Done only after its integration and required independent review pass.

## Progress — 12 November 2026

- [x] Create the Member C execution checklist and record the confirmed member slot (SET-01 contribution only; full named team allocation remains open).
- [x] Inspect the existing scheduling implementation and historical evidence to identify the starting point. See [baseline record](evidence/member-c-baseline-2026-11-12.md).
- [ ] Complete Step 1 startup and baseline verification: toolchain/setup blockers remain; no AT06/07 pass is claimed.
- [x] Draft C's source-verified scheduling API/schema contract on `codex/member-c-scheduling-contract`; see [contract and review handoffs](api/member-c-contract.md). B/A/D/F review and the shared SET-06 acceptance remain open.

## Read first and understand the starting point

Read [implementation plan](implementation-plan.md), [decisions](decisions.md), [team plan](team-plan.md), [task board](task-board.md), [testing](testing.md), [backend scheduling README](../backend/internal/scheduling/README.md) and [frontend scheduling README](../frontend/src/features/scheduling/README.md). Read the applicable nested AGENTS.md before implementation.

The baseline PDFs listed in [source documents](source-documents.md) are outside this checkout. The requirements below are derived from repository documentation; verify exact SRS wording against the supplied SRS before final acceptance.

Existing work to inspect and reuse:

| Area | Current repository evidence | Remaining check |
| --- | --- | --- |
| Schema | `backend/db/migrations/000015_scheduling.up.sql` | Review constraints, migration history and patient/plan/stage links |
| Business rules | `backend/internal/scheduling/service.go` | Verify access, availability, booking/rescheduling, lifecycle and clinical adapters |
| HTTP | `backend/internal/transport/http/scheduling.go`, conditional registration in `router.go` | Verify actual startup wiring, CSRF, roles, records and error responses |
| UI | `frontend/src/features/scheduling/`, `/scheduling` | Existing live interface requires raw patient/plan/stage/therapist IDs; evaluate usable selection flows |
| Tests | Scheduling integration and QA04 tests; frontend scheduling/inventory browser test | Reproduce results; distinguish mocked browser checks from real full-stack evidence |
| Earlier checks | [9 November implementation record](evidence/scheduling-inventory-workflows-2026-11-09.md) | Historical results are not a new run or formal AT06–07 acceptance |

The central board still marks SCH-01–06 Pending while these implementations exist. Reconcile statuses with B after verification; do not rebuild the module solely because the board says Pending.

## Work order and provisional calendar

Dates are planning targets in Asia/Colombo, not promises of clinic approval. Fix integrity/access defects before UI polish. Keep failed tests and external decisions open at submission if unresolved.

| Order | Target | Tasks and requirements | Reviewer / dependencies | Deliverable |
| --- | --- | --- | --- | --- |
| 1 | 12–14 Nov | SET-01/05; scheduling baseline | B; A setup | Working local app, baseline results and gap list |
| 2 | 14–16 Nov | C contribution to SET-03/06, UI-03; SCH-01–06, CLN-01–06 | B; A contracts, F UI; DEC02/07/08 | Scheduling contract and wireframe review packet |
| 3 | 16–19 Nov | SCH-01/02; SCH-01–06, AT06 | B; A migration/auth | Verified schema and safe availability slice |
| 4 | 19–22 Nov | SCH-03; SCH-01–06, AT06 | B; current plan/stage links | Conflict-safe booking/rescheduling slice |
| 5 | 22–25 Nov | SCH-04; SCH-01–06, CLN-01–06, AT04–07 | B; D completion evidence, DEC02/08 | Assigned therapist delivery and clinical integration |
| 6 | 25–27 Nov | SCH-05, UI-03/07; AT06/07/15 | B; F UI, A permitted lookup APIs | Usable scheduling screens and real staff journey |
| 7 | 27–29 Nov | SCH-06, QA-01/03/04/06; AT06/07, contributions to AT04/05/13/15 | B; A/F integration | Reproducible acceptance records and defect fixes |
| 8 | 29–30 Nov | OPS-03/06; B peer reviews | B/F/A as applicable | Guide, personal contribution record and demonstration |

Task labels above use the team plan; confirm the exact per-feature SCH requirement mapping in the original SRS. C contributes to shared tasks without taking over their accountable owners.

## Step 1 — Start the application and establish a baseline

- [ ] Record current branch/commit and existing changes; preserve others' work. Use small task-focused branches under the repository's branch convention (default `codex/`).
- [ ] Follow root README toolchain/database instructions. Use synthetic data and explicitly configured authentication. Never commit local credentials.
- [ ] Start frontend, Go API and a disposable PostgreSQL database. Sign in as a synthetic receptionist, assigned therapist and clinician using the existing seed/setup process.
- [ ] Open `/scheduling`; trace one action from UI → API → service → database. Write a short explanation of rooms, availability, sessions, plan/stage links and session states.
- [ ] Run relevant baseline checks below. Record failures and unavailable prerequisites rather than claiming a pass.
- [ ] Create a C gap list: implemented and verified, defective, missing, or blocked by a decision. Link findings to SCH task IDs.

Done when: you can start and explain the module, and B can reproduce the baseline. Startup alone does not pass AT06/07.

## Step 2 — Agree the scheduling contract and design

- [x] Draft `docs/api/member-c-contract.md` for C's SET-06 contribution: actual routes, request/response examples, bounded list behavior, validation/errors, role/record permissions, audit events and cross-module IDs. Source inspection complete; independent reviews remain pending in the contract.
- [ ] For SET-03, supply synthetic availability/booking examples: adjacent slots, room overlap, therapist overlap, unavailable resource and failed reschedule.
- [ ] Review DEC02/08 with B: current-stage approval, hold/resume/cancel, future booking cancellation, completion of sessions already started during hold, and stage completion evidence. Keep undecided choices as gates.
- [ ] Review the existing empty-stage completion guard with B; the 9 November record describes a conservative guard, not clinic approval of a final completion policy. Coordinate D's preparation evidence requirements.
- [ ] Confirm shared lock order and transaction boundaries for start versus hold/cancel. A clinical decision and its session effects must commit or roll back together.
- [ ] Contribute UI-03 wireframes with F: availability, booking/reschedule, therapist list, delivery observations and error/empty states. Record review before calling design accepted.
- [ ] Ask A to review shared auth/errors and any new migration numbers. Do not edit applied migrations or B's clinical schema to bypass a handoff.

Done when: the technical contract has named reviews and unresolved external decisions are explicit. Preparing this packet can proceed while clinic decisions remain open.

## Step 3 — Verify schema and availability (SCH-01/02)

- [ ] Inspect foreign keys and same-patient plan/stage consistency; room and therapist overlap constraints must work independently using `[start,end)` intervals.
- [ ] Verify valid active therapist/resource selection, valid time windows and UTC storage with Asia/Colombo display. Audit extra implementation restrictions against the SRS/decision register.
- [ ] Verify authorized creation/change of availability and rejection of changes that invalidate existing bookings. Test the availability-change versus booking race with real PostgreSQL.
- [ ] Check protected reads as well as writes, including observations hidden from reception and unrelated staff.
- [ ] Force audit insertion failure and show that the availability/business change rolls back.
- [ ] Fix demonstrated gaps with new forward-only migrations only when needed, plus focused behavior tests and API documentation.

Done when: B reviews the slice and PostgreSQL evidence supports availability and schema integrity. Carry results into AT06.

## Step 4 — Verify booking and atomic rescheduling (SCH-03)

- [ ] Book a valid synthetic patient/plan/stage with an available room and therapist; reject invalid or cross-patient links.
- [ ] Prove adjacent slots succeed; separate simultaneous room-overlap and therapist-overlap requests each have one winner.
- [ ] Reschedule successfully, then attempt a conflicting reschedule and prove the original committed booking survives unchanged.
- [ ] Reject stale-version edits, forbidden direct requests and invalid availability. Check cancellation history and transaction audit behavior.
- [ ] Record expected HTTP outcomes and safe UI messages; failures must leave prior state intact.

Done when: B reviews real PostgreSQL conflict/race/rollback results for AT06; no optimistic UI success conceals a backend failure.

## Step 5 — Verify therapist delivery and B integration (SCH-04)

- [ ] Only the assigned active therapist may start or record delivery. Deny other therapists, reception, and administrator-only users as required by record permissions.
- [ ] Check latest plan/current-stage approval in the start transaction. Booking and invoice balance must never substitute for clinical clearance.
- [ ] Test noncurrent, unapproved, held, cancelled and completed plan cases. Test concurrent start versus hold/cancel under the reviewed lock order.
- [ ] Test session observations/completion, invalid/repeated transitions, history retention and failed-audit rollback. Keep observation bodies out of logs/audit metadata.
- [ ] With B, verify future unstarted session cancellation and retained delivered history. Verify advancement waits for required delivery/preparation evidence; coordinate D-owned logic rather than assuming session completion is sufficient.
- [ ] Prove an already-started session can complete during hold under the documented rule. Keep undecided cancellation edge cases explicit.

Done when: B reviews the actual wired adapters and AT07 plus the C contribution to AT04/05 have recorded outcomes.

## Step 6 — Finish usable screens (SCH-05, UI-03/07)

- [ ] Walk through existing screens first. Prioritize defects that prevent a complete staff journey.
- [ ] Replace raw-ID entry with usable patient/plan/current-stage/therapist selection where permitted APIs support it. Coordinate lookup projections with A/B; do not expose notes or broad staff data for convenience.
- [ ] Show local dates/times, room/therapist availability, assigned sessions and appropriate state actions. Backend authorization remains authoritative.
- [ ] Handle loading, empty lists, validation, forbidden access, stale edits, conflicts and network failure with recoverable messages.
- [ ] Verify keyboard operation, labels, focus, Unicode observations and no unintended horizontal overflow at 1366×768 and 1024×768 with F.
- [ ] Add a real full-stack scheduling journey using synthetic records and the actual Go/PostgreSQL services. Keep mocked UI checks separately labelled.

Done when: receptionist booking/rescheduling and assigned therapist start/delivery are usable through the integrated app and reviewed by B/F.

## Step 7 — Record acceptance and review B's work

- [ ] Execute AT06 and AT07 with setup, steps, expected/actual results, tester, date, commit, environment and evidence paths in `docs/evidence/`; link results from `docs/testing.md`.
- [ ] Include denied direct API access, room/therapist races, adjacent bookings, availability coverage, reschedule rollback, clinical clearance and audit rollback.
- [ ] Supply C's synthetic cases for QA-01, join F's patient-to-receipt walkthrough (QA-03), and join A/F's permission/audit sweep (QA-04). Fix C-owned defects from UAT (QA-06).
- [ ] As B's reviewer, review PAT/CON/CLN evidence and the actual patient → consultation → plan → session join, including preserved signed history and AT04/05 concurrency. Record findings and review outcome; do not sign off from file presence or CI alone.
- [ ] Reconcile SCH-01–06 board status with B using evidence and review. Implementation awaiting review is not Done.

## Step 8 — Prepare submission and handover

- [ ] Write `docs/guides/member-c-scheduling.md`: roles, availability, booking, reschedule/cancel, therapist delivery, common errors and limitations. Have another member follow it with synthetic records.
- [ ] Give F your OPS-03 guide contribution and OPS-06 demonstration segment; retain shared task ownership.
- [ ] Prepare a repeatable demonstration with authorized accounts and synthetic data, including a booking conflict and blocked unauthorized start.
- [ ] Keep a personal contribution log linking your own commits/PRs, reviews, fixes and executed evidence. Confirm lecturer expectations before choosing its final format.
- [ ] Record open decisions/defects and B/F review outcomes. No claim of clinic approval, real-data authorization or pilot readiness follows from the semester demonstration.

## Checks to use during implementation

From repository root, run `./scripts/check.ps1` for the shared checks. For focused backend verification, from `backend/`:

```powershell
go test ./...
# Set TEST_DATABASE_URL privately to an explicitly disposable PostgreSQL database first.
go test -tags=integration -count=1 ./internal/scheduling ./internal/clinical ./internal/transport/http
```

From `frontend/`, use `npm run test`, `npm run lint`, `npm run typecheck` and `npm run build`; run the relevant Playwright browser/full-stack cases for changed journeys using their documented setup. See [CI/test guide](ci-and-test-guide.md) and [full-stack setup](../frontend/tests/fullstack/README.md). A skipped database test is not integrity proof; a mocked browser test is not a full-stack pass.

**First implementation session:** complete Step 1, reproduce the current scheduling checks, and choose the first demonstrated gap with B. Do not start by rewriting the existing scheduling module.
