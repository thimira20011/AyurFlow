# Reports module

Proposed owner: D/E. Reviewer: A/F. SRS: REP-01.

Committed-record stock, outstanding-invoice and actual-consumption traceability reports with per-category access restrictions.

Status: implementation boundary only. Add handler.go, service.go, repository.go and domain types with the first working feature. Services own backend permission checks and transaction boundaries; handlers validate inputs; repositories use parameterized pgx queries. Update migrations, OpenAPI, frontend screens and relevant acceptance tests together. Do not register protected routes before authentication, CSRF and record permissions exist.
