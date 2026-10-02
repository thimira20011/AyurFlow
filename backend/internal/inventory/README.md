# Inventory module

Proposed owner: D. Reviewer: E. SRS: INV-01-04; PRE-01-06.

Botanical batches, fixed-precision grams, flat recipes, immutable snapshots, manual selection, atomic actual consumption and traceability.

Status: implementation boundary only. Add handler.go, service.go, repository.go and domain types with the first working feature. Services own backend permission checks and transaction boundaries; handlers validate inputs; repositories use parameterized pgx queries. Update migrations, OpenAPI, frontend screens and relevant acceptance tests together. Do not register protected routes before authentication, CSRF and record permissions exist.
