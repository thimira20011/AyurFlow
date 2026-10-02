# Audit module

Proposed owner: A. Reviewer: F. SRS: AUD-01-02.

Restricted actor/action/object/time/reason events written inside each critical business transaction. No note bodies or secrets.

Status: implementation boundary only. Add handler.go, service.go, repository.go and domain types with the first working feature. Services own backend permission checks and transaction boundaries; handlers validate inputs; repositories use parameterized pgx queries. Update migrations, OpenAPI, frontend screens and relevant acceptance tests together. Do not register protected routes before authentication, CSRF and record permissions exist.
