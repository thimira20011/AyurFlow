# Clinical module

Proposed owner: B. Reviewer: C. SRS: CLN-01-06.

One agreed ordered pathway, clinician approvals, hold/resume/cancel and shared current-stage session clearance.

Status: implementation boundary only. Add handler.go, service.go, repository.go and domain types with the first working feature. Services own backend permission checks and transaction boundaries; handlers validate inputs; repositories use parameterized pgx queries. Update migrations, OpenAPI, frontend screens and relevant acceptance tests together. Do not register protected routes before authentication, CSRF and record permissions exist.
