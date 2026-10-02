# Auth module

Proposed owner: A. Reviewer: F. SRS: IAM-01-05.

Staff accounts, Argon2id passwords, opaque sessions, expiry/revocation, throttling, CSRF and backend role/record checks.

Status: implementation boundary only. Add handler.go, service.go, repository.go and domain types with the first working feature. Services own backend permission checks and transaction boundaries; handlers validate inputs; repositories use parameterized pgx queries. Update migrations, OpenAPI, frontend screens and relevant acceptance tests together. Do not register protected routes before authentication, CSRF and record permissions exist.
