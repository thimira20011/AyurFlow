# Clinical module

Proposed owner: B. Reviewer: C. SRS: CLN-01-06.

One agreed ordered pathway, clinician approvals, hold/resume/cancel and shared current-stage session clearance.

TASK-CLN-01 adds migration `000009_care_pathway.up.sql` for patient-linked care plans, optional same-patient source consultations, ordered stage snapshots, separate plan and stage statuses, current-stage references, actor/time fields, and append-only decision history. A PostgreSQL integration test checks the main linkage and integrity constraints. No pathway labels or checklist are seeded: DEC02 must supply the approved order and checks, and A must confirm the migration number. C reviews the plan/stage/session join.

The `member-b/patient-clinical-completion` branch adds a fixed PREPARATORY → PRIMARY → RECOVERY pathway, with NOT_STARTED represented by draft state and COMPLETED by terminal state. Creation snapshots the three stage checklists; an explicit clinician start decision moves NOT_STARTED to PREPARATORY. Assigned clinicians can create, read and approve the current stage, hold and resume a plan with a reason, and inspect append-only decisions through protected, CSRF-gated routes. Approval requires exact checklist confirmation, a current version and a signed consultation for PREPARATORY. A current-stage clearance function checks active/approved plan state inside C's session-start transaction. All mutations and their audit events commit together. The clinician screen is `/clinical/plans`.

Stage advancement calls a `CompletionPolicy` in the same transaction. Cancellation calls a `SessionCancellation` adapter in the same transaction so future unstarted sessions are cancelled without changing delivered history. Neither production adapter can be supplied by B until C's scheduling/session tables and D's preparation evidence contract exist; the API returns 409 and makes no mutation in their absence. C must acquire the plan lock before its session lock and call `RequireSessionClearance` in its start transaction. Integration tests use synthetic adapters to prove B's transaction, rollback and terminal-state behavior. Formal AT04–05 still needs C's integration, race evidence and reviewer sign-off.

Services own backend permission checks and transaction boundaries; handlers validate inputs; repositories use parameterized pgx queries. Update OpenAPI when protected behavior is implemented and reviewed. Do not register protected routes before authentication, CSRF and record permissions exist.
