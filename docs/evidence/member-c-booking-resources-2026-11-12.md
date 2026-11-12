# Member C independent booking resource verification

Date: 12 November 2026. Task: TASK-SCH-06 verification slice supporting TASK-SCH-03. Requirement scope: SCH-01–06 booking/resource integrity, partial AT06. Owner C; reviewer B. Base: merged dev `3fab3274c710811441b209fb71454c35a712ab9e`. Branch: `codex/member-c-booking-race-tests`. Tester: Codex-authored synthetic integration cases, executed by the branch CI when available.

## Why add these cases

The prior booking race uses the same room and therapist for both requests. Either exclusion constraint could reject the second request and hide a missing constraint for the other resource. The new cases share exactly one resource and use different patients/plans, plus valid availability and clinician-approved current stages. Two goroutines wait at a common release gate before calling the real booking service. A bounded context prevents an indefinite lock wait. No sleep or mock database determines the outcome; the PostgreSQL constraints decide the committed result.

## Setup, steps and expected outcome

`TestBookingResourceConstraintsIntegration` applies the real migrations in a fresh isolated schema for each case. It seeds synthetic receptionist/clinician/two therapist accounts, two active rooms, covering availability and two valid patient plans. Both requests run concurrently. Their results are collected and successful bookings are reread from PostgreSQL to verify all requested links, resources, interval, booked state and initial version. Session rows and booking audit rows must match one-for-one, with the correct actor and no orphan booking audit.

| Case | Second request relative to first | Expected committed / conflict counts |
| --- | --- | --- |
| room_only_overlap | Same room, different therapists, 30-minute overlap | 1 / 1 |
| therapist_only_overlap | Different rooms, same therapist, 30-minute overlap | 1 / 1 |
| independent_resources_overlap | Different rooms and therapists, 30-minute overlap | 2 / 0 |
| adjacent_after | Same room/therapist, starts exactly when first ends | 2 / 0 |
| adjacent_before | Same room/therapist, ends exactly when first starts | 2 / 0 |

The loser in conflict cases must leave neither a session nor an extra booking audit event. The adjacent cases check both boundary directions for `[start,end)`. The successful request is intentionally nondeterministic in overlap cases.

## Execution and limits

Local gofmt and `git diff --check` pass. Local runtime verification remains unavailable with the recorded mismatched Go toolchain and absent disposable PostgreSQL configuration; CI must execute the real tests with `TEST_DATABASE_URL`, the `integration` tag, race detection and skipped-test rejection. Record the final commit/run and actual outcomes in the PR before review. Focused reproduction from `backend/` after configuring a disposable PostgreSQL instance:

```powershell
go test -race -tags=integration -run '^TestBookingResourceConstraintsIntegration$' -count=1 -timeout=5m -v ./internal/scheduling
```

This slice adds behavior verification without changing production code, schema, endpoints or access policy. Formal AT06 remains open for availability-change races, complete reschedule/HTTP/browser evidence and B review; AT07 and DEC02/07/08 gates remain unchanged. An automated CI pass does not itself close the parent SCH-03/SCH-06 task.
