# Billing module

Proposed owner: E. Reviewer: D. SRS: BIL-01-06.

Draft/issued invoices, integer LKR minor units, direct deposits/receipts, balance protection and idempotent receipt operations.

Status: implementation boundary only. Add handler.go, service.go, repository.go and domain types with the first working feature. Services own backend permission checks and transaction boundaries; handlers validate inputs; repositories use parameterized pgx queries. Update migrations, OpenAPI, frontend screens and relevant acceptance tests together. Do not register protected routes before authentication, CSRF and record permissions exist.
