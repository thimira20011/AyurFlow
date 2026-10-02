# Scheduling module

Proposed owner: C. Reviewer: B. SRS: SCH-01-06.

Room/therapist availability, half-open intervals, database overlap constraints, atomic rescheduling and assigned therapist delivery.

Status: implementation boundary only. Add handler.go, service.go, repository.go and domain types with the first working feature. Services own backend permission checks and transaction boundaries; handlers validate inputs; repositories use parameterized pgx queries. Update migrations, OpenAPI, frontend screens and relevant acceptance tests together. Do not register protected routes before authentication, CSRF and record permissions exist.
