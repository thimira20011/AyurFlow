# Member C protected delivery API verification — 27 November 2026

Task: TASK-SCH-04 and TASK-SCH-06 contribution. Owner C; reviewer B pending. Requirements: scheduling SCH-01–06 assigned-therapist delivery and history rules, shared role/record access and transactional audit; AT07 support with permission/privacy evidence for AT13. Exact per-requirement SRS mapping needs the original baseline. DEC02/07/08 and independent acceptance remain open.

Branch `codex/member-c-delivery-api-verification`, based on `dev` `a2e5be496fdecf9b7bb8f4f174f9d79e26f69a9e`, after PRs #99/#100 were merged. Existing production behavior is under verification. No endpoint, migration, business policy or UI changes; OpenAPI remains unchanged. The scheduling task board is reconciled to one row each for SCH-03/SCH-04, preserving the merged evidence and In progress statuses.

## Setup and reproduction

Tester: Codex automation, 27 November 2026. Test file: `backend/internal/transport/http/scheduling_delivery_integration_test.go`. Each suite creates an isolated migrated disposable PostgreSQL schema, synthetic reception/clinician/therapist/admin accounts and real authenticated sessions. A signed synthetic consultation, explicit clinician assignment, approved current stage, room/resource windows and two future bookings establish valid preconditions. Production clinical/scheduling services create the plan/bookings; delivery actions and protected reads use the actual Gin router, session middleware, CSRF checks and PostgreSQL services. No session/auth mocks are used. Forged staff/role headers in the shared HTTP test helper cannot replace server identity.

From `backend`, privately configure `TEST_DATABASE_URL` to an explicitly disposable database, then run:

```powershell
go test -race -tags=integration -count=1 -timeout=5m -v ./internal/transport/http
```

CI executes the full integration suite on Linux with workflow-pinned Go 1.27.4, PostgreSQL 17.11, race detection, shuffled ordering and the no-skipped-tests gate. Local Windows runtime execution is blocked by Go 1.26.2 versus required 1.27.4 and no configured disposable database; unavailable checks are not counted as passes. Local gofmt/whitespace checks run before publication.

## Steps and expected results

| Case group | Steps and expected outcomes |
| --- | --- |
| Start and completion permissions | For each action: anonymous 401; missing/wrong CSRF 403; other therapist, reception, administrator-only and assigned clinician 404. Disable the assigned therapist with its existing session: 401. Full session and scheduling-audit snapshots remain unchanged after every rejected request. Error responses omit submitted observations and patient ID. |
| Valid assigned delivery | Assigned active therapist starts a booked session and completes it with synthetic Sinhala/Tamil observations. Response and saved observations match exactly, status becomes completed and version advances twice. |
| Invalid and repeated transitions | Complete before start, repeated start, cancellation while running, rewrite/restart/cancel after completion, and start/complete/repeated cancel after cancellation return 409 without changing committed session/audit snapshots. Reception can cancel the second booked session once. |
| Completion validation | Blank/oversized observations return 422; unknown actor field/trailing JSON return 400; no mutation or business audit is committed. |
| Protected read projections | Reception sees the completed booking with observations omitted; assigned therapist/clinician see the exact Unicode observations; unrelated therapist sees zero rows; administrator-only gets 404 and anonymous gets 401. Reads do not change session/history. |
| Audit identity/privacy | Exactly one matching assigned-therapist start/completion and one reception cancellation audit. Observation text does not appear in those audit records. Rejected requests emit no scheduling mutation audit. |

The disabled-account fixture obtains a fresh session after test-only account reset before continuing. This is isolated fixture management, not a new reactivation feature. Existing QA04 tests independently force scheduling audit failures and cover rollback; existing clinical race tests cover hold/cancel interleavings. These cases do not duplicate those harnesses.

## Completion and execution attachment

- [x] Author direct HTTP permission, lifecycle, Unicode, projection and audit assertions against real services/PostgreSQL.
- [x] Format the Go test and update checklist, task board and this reproducible evidence record.
- [ ] B independently reviews the delivery/access behavior and evidence.

The associated pull request's execution section is the attachment to this record. It records the tested commit, expected versus actual outcomes, CI environment, job links and required-check results. Authored cases alone are not a pass; failed CI runs remain visible. Parent SCH-04/SCH-06 and full AT07/13 remain open pending independent review and remaining coverage.

Scope limits: requests use the real router in-process; this is not a live HTTPS browser/viewport test or full patient-to-receipt walkthrough. New clinical policy, all clearance states, therapist reactivation, clinic approval and real-data/pilot authorization are not established.
