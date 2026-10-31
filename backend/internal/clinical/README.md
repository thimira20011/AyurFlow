# Clinical module

Proposed owner: B. Reviewer: C. SRS: CLN-01-06.

One agreed ordered pathway, clinician approvals, hold/resume/cancel and shared current-stage session clearance.

TASK-CLN-01 adds migration `000009_care_pathway.up.sql` for patient-linked care plans, optional same-patient source consultations, ordered stage snapshots, separate plan and stage statuses, current-stage references, actor/time fields, and append-only decision history. A PostgreSQL integration test checks the main linkage and integrity constraints. No pathway labels or checklist are seeded: DEC02 must supply the approved order and checks, and A must confirm the migration number. This schema alone does not implement approval, advancement, hold, cancellation, session clearance or a protected HTTP route; those belong to CLN-02–04. C reviews the plan/stage/session join.

Services own backend permission checks and transaction boundaries; handlers validate inputs; repositories use parameterized pgx queries. Update OpenAPI when protected behavior is implemented and reviewed. Do not register protected routes before authentication, CSRF and record permissions exist.
