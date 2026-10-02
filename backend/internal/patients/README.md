# Patients module

Proposed owner: B. Reviewer: C. SRS: PAT-01-02; CON-01-03.

Patient registration/search with optional identity, clinician consultation drafts, immutable signing and dated addenda.

Status: implementation boundary only. Add handler.go, service.go, repository.go and domain types with the first working feature. Services own backend permission checks and transaction boundaries; handlers validate inputs; repositories use parameterized pgx queries. Update migrations, OpenAPI, frontend screens and relevant acceptance tests together. Do not register protected routes before authentication, CSRF and record permissions exist.
