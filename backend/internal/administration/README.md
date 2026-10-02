# Administration module

Proposed owner: A. Reviewer: F. SRS: ADM-01; IAM-01.

Explicit role assignment, controlled accounts and permitted reference data. Administrator alone does not grant clinical access.

Status: implementation boundary only. Add handler.go, service.go, repository.go and domain types with the first working feature. Services own backend permission checks and transaction boundaries; handlers validate inputs; repositories use parameterized pgx queries. Update migrations, OpenAPI, frontend screens and relevant acceptance tests together. Do not register protected routes before authentication, CSRF and record permissions exist.
