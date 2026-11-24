# Member C session clearance and cancellation verification — 24 November 2026

Task: TASK-SCH-04 and TASK-SCH-06 contribution. Owner C with B; reviewer B pending. SRS scheduling SCH-01–06 and clinical CLN-01–06; AT07 support and C contribution to AT04/05. Exact individual SRS mapping requires the original baseline. Dependencies: migration 000015, clinical current-stage clearance and real scheduling cancellation adapter, role/record checks and transactional audits. DEC02/08 and formal acceptance remain open.

Branch `codex/member-c-session-clearance-races`, based on `dev` `075018f452be0c75c0444f0238cc0355bef8d985`. Open PRs #95 and #99 are independent, not dependencies. No production logic, migration, endpoint or UI changes. This verifies documented development behavior rather than deciding additional clinical policy.

## Setup and reproduction

Tester: Codex automation, 24 November 2026. File: `backend/internal/scheduling/session_clearance_integration_test.go`. Each case migrates an isolated disposable PostgreSQL schema and creates only synthetic reception, assigned clinician, therapist, approved current-stage plan, room, availability and two future bookings. Tests call both production services with the actual scheduling cancellation adapter.

From `backend`, privately set `TEST_DATABASE_URL` to an explicitly disposable PostgreSQL database, then run:

```powershell
go test -race -tags=integration -count=1 -timeout=5m -v ./internal/scheduling
```

CI uses Go 1.27.4, PostgreSQL 17.11, Linux, shuffled full integration suite and a no-skipped-tests gate. Local Windows execution is unavailable with installed Go 1.26.2 and no configured disposable database; unavailable checks are not passes. Local gofmt and whitespace checks are recorded with the PR.

## Steps and expected results

The four race cases use test-only triggers to pause the leading operation after its production plan lock is acquired. A controller holds an advisory lock; observed PostgreSQL blocking dependencies prove the first request waits at the gate and the competing request waits behind its plan lock. Then the controller releases the gate. This avoids assuming a lock ordering from timing alone.

| Case | Expected |
| --- | --- |
| Start before hold | Start and hold both commit in order; started session stays in progress, other booking remains booked, subsequent starts are blocked. The assigned therapist can complete the started session during hold. |
| Hold before start | Hold commits; waiting start returns conflict. Both bookings retain their original allocation/version; no start audit exists. |
| Start before cancel | Start commits first; cancellation retains that in-progress session and cancels only the other future unstarted booking. No completion-after-cancellation policy is asserted. |
| Cancel before start | Plan and both future unstarted session cancellations commit together; waiting start returns conflict and emits no start audit. |
| Cancellation final-audit failure and retry | Complete one session, retain another future booking. Force `plan.cancel` audit insertion to fail after the real adapter has updated the booking and written its session audit. The complete plan, decision, session and audit snapshot must remain unchanged. Remove the failure trigger and retry with the same still-current version: future booking cancels once and the full completed delivery row remains unchanged. |

Each race also checks plan version increments once, unchanged allocation and patient/plan/stage links, exact per-session mutation versions and actor/object audit counts, and one matching plan decision/audit.

## Completion and execution record

- [x] Author five real-service/PostgreSQL regression cases with controlled race orderings and rollback assertions.
- [x] Add the reproduction procedure and update the Member C checklist/task board.
- [ ] B independently reviews the clinical/scheduling boundary and evidence.

The associated pull request's validation/execution section records the tested commit, environment, expected/actual case results and final required-check results, with links to the GitHub job logs. It is the execution attachment to this record; authored cases alone are not a pass. Failed runs remain visible in GitHub history.

Scope limits: no new cancellation clinical policy, direct HTTP/CSRF or browser proof, full AT04–07 acceptance, clinic approval, real-data authorization or release readiness. Parent SCH-04/SCH-06 remain In progress pending remaining coverage and independent review.
