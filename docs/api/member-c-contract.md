# Member C scheduling contract

Status: implementation inventory and review draft, 12 November 2026. TASK-SET-06 contribution; C owns scheduling, B reviews, A coordinates shared API/schema/security, F reviews interface integration. Requirement scope: SCH-01–06 and the CLN-01–06 join; acceptance scope AT06–07 with contributions to AT04–05/13/15. Exact requirement mapping must be checked against the original SRS in [source documents](../source-documents.md).

Reviewed source baseline: merged dev `8462d2fcde949de3f5e7cd5c343200123e06ab12`. This document describes existing source behavior, not clinic approval or an executed AT result. DEC02/07/08 and the other [decision gates](../decisions.md) remain open. Only independently reviewed endpoints belong in published OpenAPI; this draft does not expand that publication.

## Sources and ownership boundaries

| Concern | Source / accountable module |
| --- | --- |
| Schema | `backend/db/migrations/000015_scheduling.up.sql`; C owns rooms, resource availability and therapy sessions |
| Business behavior | `backend/internal/scheduling/service.go`; transaction, authorization and audit checks |
| HTTP | `backend/internal/transport/http/scheduling.go`, `router.go`, `protected.go` |
| Production wiring | `backend/cmd/api/main.go`; auth-enabled startup supplies the scheduling service to both transport and clinical adapters |
| Client | `frontend/src/features/scheduling/api.ts` and scheduling workspace; Next.js calls `/api/v1` |
| Clinical authority | B owns plans, stages, assignment and `clinical.RequireSessionClearance`; C consumes these contracts without changing B's schema |
| Preparation evidence | D owns preparation and consumption; the current completion adapter queries prepared records linked to C's sessions |

Stored IDs are server-generated UUIDs. A patient, plan and stage must refer to the same clinical chain. Existing composite foreign keys enforce plan/patient and stage/plan consistency. All instants are stored in UTC; the UI displays Asia/Colombo. Booking intervals are half-open `[start,end)`.

## Authentication and access

Scheduling routes are registered under `/api/v1` only when the router has an authentication service and scheduling service. Normal startup supplies these when authentication is explicitly configured. `RequireSession` authenticates the server session cookie; writes also require the allowed Origin and `X-CSRF-Token`. Cross-site requests are denied and protected responses use `Cache-Control: no-store`. Actor IDs come from middleware, never a client body.

The service rechecks active accounts and database roles in the business transaction. Administrator-only accounts have no scheduling permission. Current role selection for session lists prioritizes receptionist, then therapist, then clinician for accounts with multiple roles; it does not union their record scopes.

| Operation | Current role / record restriction |
| --- | --- |
| List active rooms or resource availability | Receptionist, therapist or clinician; availability is a shared resource view |
| Create room; add/change availability | Receptionist |
| Book, reschedule or cancel booking | Receptionist; linked patient/plan/stage and booking rules still apply |
| List sessions as receptionist | Booking projection for all sessions in the requested window; observations are null |
| List sessions as therapist | Only sessions assigned to that therapist |
| List sessions as clinician | Only patients with a current, unrevoked patient/clinician assignment |
| Start or complete | Active therapist assigned to that session; state and clearance rules below |

## HTTP surface implemented in source

All paths below include prefix `/api/v1`. Create operations return 201 with the created object; lists and lifecycle actions return 200. There is no scheduling delete endpoint, generic session-by-ID GET, or public scheduling endpoint.

| Method / path | Input | Success body |
| --- | --- | --- |
| GET `/rooms` | No query parameters | `{ "items": Room[] }` |
| POST `/rooms` | `{ "code": string, "name": string }` | Room |
| GET `/availability` | `start`, `end`: RFC3339 query instants | `{ "items": Availability[] }` |
| POST `/availability` | `{ "roomId": UUID or null, "therapistId": UUID or null, "startsAt": instant, "endsAt": instant }` | Availability |
| POST `/availability/:id/change` | `{ "startsAt": instant, "endsAt": instant }` | Availability |
| GET `/sessions` | `start`, `end`: RFC3339 query instants | `{ "items": Session[] }` |
| POST `/sessions` | Booking body below | Session |
| POST `/sessions/:id/reschedule` | `{ "roomId": UUID, "therapistId": UUID, "startsAt": instant, "endsAt": instant, "version": positive integer }` | Session |
| POST `/sessions/:id/start` | No application body required | Session |
| POST `/sessions/:id/complete` | `{ "observations": string }` | Session |
| POST `/sessions/:id/cancel` | `{ "reason": string }` | Session |

Room has `id`, `code`, `name`, `active`. Availability has `id`, nullable `roomId` and `therapistId`, `startsAt`, `endsAt`. Exactly one resource ID is supplied for an availability window. Session has `id`, `patientId`, `planId`, `stageId`, `roomId`, `therapistId`, `startsAt`, `endsAt`, `status`, nullable `observations`, nullable `cancellationReason`, and integer `version`.

Room lists return at most 100 active rooms ordered by code. Availability/session queries require `end > start` and a window of at most 31 days; results overlap the requested interval and are ordered by start then ID, capped at 200. **There is no cursor, next-page indicator or completeness guarantee.** Empty service slices currently serialize `items` as null. Clients and follow-up contracts must account for this; these are review gaps, not approved pagination defaults.

Synthetic booking request (replace example IDs with IDs created in the disposable environment; choose a future clinic date):

```json
{
  "patientId": "10000000-0000-4000-8000-000000000001",
  "planId": "20000000-0000-4000-8000-000000000001",
  "stageId": "30000000-0000-4000-8000-000000000001",
  "roomId": "40000000-0000-4000-8000-000000000001",
  "therapistId": "50000000-0000-4000-8000-000000000001",
  "startsAt": "2026-12-01T09:00:00+05:30",
  "endsAt": "2026-12-01T10:00:00+05:30"
}
```

JSON mutations use the shared `billingJSON` decoder despite its name. It rejects invalid bodies; no scheduling-specific decoder is introduced by this document.

## Validation, transitions and concurrency

- Room creation trims code/name, requires nonempty values, limits code to 64 bytes and name to 120 bytes, and checks valid UTF-8 for the name. Room code uniqueness is database-enforced.
- Availability writes and booking/reschedule windows currently require a nonzero start later than approximately now minus one minute, positive duration, and a duration no greater than 24 hours. These source restrictions need A/B review against the SRS; they are not newly approved clinic rules.
- Availability requires an active room or active therapist. Changing a window is rejected if a booked/running session would lose coverage and no other single window covers it. Booking locks covering room and therapist availability rows for share; edits lock the changed row for update. Each resource needs one window covering the entire booking; adjacent windows are not combined.
- Booking requires an active plan, its current approved stage, active room and active therapist. It locks plan/stage for share and validates coverage. Separate PostgreSQL exclusion constraints reject room overlaps and therapist overlaps among booked/in-progress sessions. Adjacent bookings may share resources.
- Rescheduling is allowed only for a future booked session with the current version. It validates the proposed booking before updating the session. A conflict rolls back, retaining the original booking. Successful reschedule increments the version.
- Start requires an assigned therapist and a booked session. It reads the plan/stage linkage, obtains clinical clearance inside the transaction, then locks/rechecks the session. It changes status to `in_progress` and increments the version. Current code has no scheduled-time proximity check; any such rule requires a reviewed decision.
- Completion requires the assigned therapist, `in_progress` state, and trimmed nonempty valid UTF-8 observations up to 8000 bytes. It changes status to `completed` and increments the version. It does not recheck plan clearance, allowing an already-started session to finish during hold.
- Reception cancellation requires `booked` state and a trimmed nonempty valid UTF-8 reason up to 1000 bytes; it increments the version. Current cancellation has no future-time check. Completed/cancelled records cannot be changed/deleted through the history trigger; running session allocation/time and all patient/plan/stage links are protected.
- There is no scheduling operation-ID retry contract. Start, complete and cancel are state transitions; a retry after success conflicts rather than replaying the original response. Consumption/receipt operation IDs remain D/E-owned.

Plan and stage locks precede session locks for booking/reschedule/start versus B's plan decisions. B locks the plan for update; clinical clearance takes plan/stage share locks before C locks the session. Hold first means a later start is denied. Start first may be followed by hold and the running session may complete. Transactional race proof must accompany formal AT04–07 acceptance.

`scheduling.Service` is supplied as B's completion and future-cancellation adapters in production startup. `CanComplete` currently requires at least one completed session, no booked/running session, and no linked preparation still in `prepared` state. It does not require a preparation to exist for every session. Empty-stage completion and required preparation evidence need DEC02/03/08 review with B/D. `CancelFuture` runs inside B's plan transaction, locks future booked sessions in ID order, cancels them and records each audit event; started/completed history is retained. Past-due unstarted sessions are not cancelled by this adapter: review this edge case explicitly.

## Errors and audit

Errors use `{ "error": { "code": string, "message": string } }`. Missing/invalid session authentication returns 401. Origin/CSRF rejection returns 403. Malformed JSON or unparseable list query instants return 400. Service validation returns 422 `validation_failed`; workflow/version/overlap conflicts return 409 `conflict`. Scheduling service forbidden and missing-record errors both map to 404 `not_found` to avoid disclosing records. Unexpected scheduling errors map to 503 `unavailable`. Do not document every role denial as 403: middleware and service behavior differ.

| Mutation | Critical audit action |
| --- | --- |
| Create room | `room.created` |
| Add/change availability | `availability.created`, `availability.changed` |
| Book/reschedule/start/complete | `session.booked`, `session.rescheduled`, `session.started`, `session.completed` |
| Cancel directly / through plan cancellation | `session.cancelled`, reason code `booking_cancelled` / `plan_cancelled` |

Every event is inserted in the caller's business transaction. Audit failure rolls back the mutation. Events use object/actor IDs, changed-field names and bounded reason codes; they omit observation bodies. Cancellation reasons remain protected business data, not a new logging field. No generic scheduling audit-reader permission is approved here.

## Review and next implementation work

| Reviewer / handoff | Required outcome | Status |
| --- | --- | --- |
| B | Plan/stage linkage, start/hold/cancel semantics and completion policy | Pending |
| A | Shared errors, role/record/CSRF controls, migration boundaries and bounded-list contract | Pending |
| D | Preparation evidence and safe completion/consumption join | Pending |
| F | List/empty handling, booking selection projections and usable failure states | Pending |
| Team/clinic | DEC02/07/08 and affected clinical rules; DEC03 where preparation is required | Pending |

Prioritize these follow-ups: empty list consistency and usable patient/plan/therapist selection (SCH-05), independent room-only/therapist-only overlap and adjacent-slot tests (SCH-03/06), booking versus availability-change race evidence (SCH-02/06), and real full-stack AT06/07 journeys. Resolve pagination/truncation and lifecycle edge cases with the accountable reviewers before changing policy.

Existing executable evidence lives in scheduling `service_integration_test.go`, `qa04_integration_test.go`, protected HTTP tests and frontend browser cases. The [9 November record](../evidence/scheduling-inventory-workflows-2026-11-09.md) labels historical checks and their limits. This draft is complete as C's authored SET-06 contribution; shared SET-06 and all feature acceptance remain open until review and integration evidence pass.
