# Member C atomic reschedule verification — 24 November 2026

Task: TASK-SCH-03 and verification contribution TASK-SCH-06. Owner C; reviewer B (pending). Requirements: scheduling SCH-01–06, atomic reschedule/retained booking rule in the implementation plan; AT06 support. Exact per-feature SRS mapping still requires the original source baseline. Dependencies: existing migration 000015, current approved clinical stage, authenticated reception service checks and transactional audit. DEC02/08 and full acceptance remain open; this adds no clinical policy.

Branch: `codex/member-c-reschedule-integrity`, based on `dev` `075018f452be0c75c0444f0238cc0355bef8d985`. PR #95 remains separate and is not a dependency. No production code, migration, endpoint, OpenAPI or UI changes are needed for these checks. The existing reschedule contract remains unchanged.

## Setup and reproduction

Tester: Codex automation, 24 November 2026. Test file: `backend/internal/scheduling/reschedule_integrity_integration_test.go`. Use synthetic reception, clinician, two therapists, two rooms, an approved current-stage plan and future availability. Each subcase uses the real service against an independently migrated disposable PostgreSQL schema through `testutil.Postgres`.

From `backend`, privately configure `TEST_DATABASE_URL` for an explicitly disposable database, then run:

```powershell
go test -race -tags=integration -count=1 -timeout=5m -v ./internal/scheduling
```

CI runs the full PostgreSQL integration suite with race detection, shuffled ordering and the no-skipped-tests gate. Never use real patient data. Local formatting and whitespace checks run on Windows. Local runtime execution is blocked: installed Go 1.26.2 cannot satisfy `go.mod` Go 1.27.4, and no disposable database is configured. Local unavailable checks are not counted as passes.

## Cases and expected outcomes

| Case | Steps | Expected |
| --- | --- | --- |
| Room-only conflict | Successfully change room, therapist and time. Create a target booking sharing only its room. Reschedule into it. | Conflict; complete original session row, including timestamps/version, remains unchanged; exactly one earlier successful-reschedule audit. |
| Therapist-only conflict | As above, target shares only the therapist. | Same rollback result, independently exercising therapist exclusion. |
| Unavailable target | Successfully reschedule, then request a time outside both resources' availability. | Conflict; full saved row unchanged; no rejected-edit audit. |
| Same-version concurrency | Lock the original session in a controller transaction. Launch two different valid reschedules using version 1. Observe both backend lock waits (including the row-lock waiter chain), then release the controller. | Exactly one success and one conflict; persisted allocation equals the winner, version advances once, clinical links remain unchanged and exactly one matching actor/object reschedule audit exists. |

Existing `TestQA04SchedulingAuditFailureRollsBack/reschedule` forces an actual audit-insert exception after a valid reschedule update and compares the complete business/audit snapshot. It complements the new cases without duplicating that failure harness.

## Execution and review status

- [x] Author the four focused PostgreSQL cases and review source against existing service semantics.
- [x] Run gofmt and local diff whitespace validation.
- [x] Execute the new cases and existing reschedule audit-failure regression in CI on `1696e9f8398ff2bb0975c01014839fae4ff1a64c`; both PostgreSQL integration jobs passed race detection and the no-skips gate. Full required checks on the final documentation commit are tracked in PR #99.
- [ ] B reviews behavior, evidence and remaining AT06 coverage.

Actual outcomes matched expectations in [integration job 138521905370](https://github.com/thimira20011/AyurFlow/actions/runs/45415848578/job/138521905370) on implementation `1696e9f8398ff2bb0975c01014839fae4ff1a64c`: room-only 0.90 s, therapist-only 1.12 s, unavailable target 0.64 s, same-version concurrency 0.99 s, and existing audit-failure reschedule 0.01 s, all passed. The job ran the full suite with `-race -tags=integration -shuffle=on -count=1 -timeout=5m` and passed the no-skipped-tests gate. Runner: GitHub-hosted Ubuntu with the workflow-pinned Go toolchain and real PostgreSQL service. [PR #99](https://github.com/thimira20011/AyurFlow/pull/99) records final-head CI status. These tests cover service/database behavior; they do not establish browser usability, direct HTTP/CSRF behavior, reschedule-versus-availability races, all booking/clinical transitions, full AT06/07, clinic approval or pilot readiness. Parent SCH-03/SCH-06 remain In progress.

