# Clinical module

Proposed owner: B. Reviewer: C. SRS: CLN-01-06.

One agreed ordered pathway, clinician approvals, hold/resume/cancel and shared current-stage session clearance.

TASK-CLN-01 adds migration `000009_care_pathway.up.sql` for patient-linked care plans, optional same-patient source consultations, ordered stage snapshots, separate plan and stage statuses, current-stage references, actor/time fields, and append-only decision history. A PostgreSQL integration test checks the main linkage and integrity constraints. No pathway labels or checklist are seeded: DEC02 must supply the approved order and checks, and A must confirm the migration number. C reviews the plan/stage/session join.

TASK-CLN-02 adds transactional plan creation, current-stage approval and one-stage advancement in `service.go`. Creation requires an explicitly supplied pathway definition and copies its stage/checklist snapshots; callers cannot submit arbitrary stage labels. Approval requires the assigned clinician, the current pending stage, an exact checklist confirmation and the current version. Advancement requires the current approved stage and a non-nil completion-evidence policy in the same transaction; no production policy exists until DEC02 and C's session join are reviewed. Every successful mutation writes structured audit metadata in its transaction. Direct service tests cover role/assignment denial, future-stage and stale decisions, blocked completion, final completion and failed-audit rollback. The API still does not register plan routes. Hold/resume/cancel and session clearance belong to CLN-03–04.

Services own backend permission checks and transaction boundaries; handlers validate inputs; repositories use parameterized pgx queries. Update OpenAPI when protected behavior is implemented and reviewed. Do not register protected routes before authentication, CSRF and record permissions exist.
