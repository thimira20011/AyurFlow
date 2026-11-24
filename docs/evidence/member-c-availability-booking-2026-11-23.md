# Availability versus booking integrity — 23 November 2026

Task: TASK-SCH-02 / TASK-SCH-06 verification slice. Requirements: SCH-01–06 availability/booking integrity, partial AT06; transaction audit supports AT13. Owner C, reviewer B. Baseline: merged dev `288abb403ec5af6a2efdfabb01ca8f172d6223ef`. Branch: `codex/member-c-availability-booking-races`. Synthetic fixtures only. DEC02/07/08 and full AT06/07 acceptance remain open.

## Setup and steps

`TestAvailabilityBookingInterleavingsIntegration` uses the real migration runner and a fresh PostgreSQL schema per case, a synthetic receptionist/clinician/therapist, an active room, covering availability and an approved current-stage plan. The requested edit removes coverage for the proposed booking. The unmodified service methods execute in separate concurrent transactions.

A test-only trigger pauses the first mutation after its production row locks have been acquired. A controller transaction holds a unique advisory gate keyed by its PostgreSQL backend PID. The test observes the first operation blocked on that gate, starts the second operation, then observes it blocked on the first operation's backend using `pg_blocking_pids`. Only then is the gate released. Lock observation uses a bounded context and polling; no arbitrary sleep decides operation order. Test triggers exist only in isolated test schemas, and no applied migration is edited.

## Expected outcomes

| Resource / ordering | Expected result | Committed booking / booking audit / availability-change audit |
| --- | --- | --- |
| Room, booking first | Booking succeeds; edit conflicts; original window retained | 1 / 1 / 0 |
| Room, edit first | Edit succeeds; booking conflicts; edited window retained | 0 / 0 / 1 |
| Therapist, booking first | Booking succeeds; edit conflicts; original window retained | 1 / 1 / 0 |
| Therapist, edit first | Edit succeeds; booking conflicts; edited window retained | 0 / 0 / 1 |

After both operations finish, query the saved availability and count committed session/audit rows. In every case, a final SQL invariant checks that every saved booked/running session retains a single covering room window and a single covering therapist window. Rejected operations must create no successful mutation audit and leave the winning committed state intact. Existing `TestQA04SchedulingAuditFailureRollsBack` separately covers forced availability-audit failure rollback.

## Execution record

Local gofmt and `git diff --check` pass. The recorded local toolchain and disposable database setup limitations remain; actual execution requires branch CI with the pinned Go toolchain, PostgreSQL, `integration` tag, race detection and skipped-test rejection. Final commit, job links and per-case actual results are recorded in the PR after CI. No runtime pass is claimed before that execution.

Focused reproduction from `backend/` with an explicitly disposable `TEST_DATABASE_URL` and migration privileges:

```powershell
go test -race -tags=integration -run '^TestAvailabilityBookingInterleavingsIntegration$' -count=1 -timeout=5m -v ./internal/scheduling
```

This slice tests one edited availability window versus one booking in both lock orderings. It does not claim proof for concurrent edits of multiple alternative covering windows, reschedule-versus-edit, or clinical transition races. Those and the integrated staff journey remain separate review/acceptance concerns. Production behavior, endpoints, schemas and OpenAPI publication are unchanged unless a demonstrated defect requires a follow-up fix in this PR.
