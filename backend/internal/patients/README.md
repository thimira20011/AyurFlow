# Patients module

Proposed owner: B. Reviewer: C. SRS: PAT-01-02; CON-01-03.

Patient registration/search with optional identity, clinician consultation drafts, immutable signing and dated addenda.

Status: TASK-PAT-01 schema and provisional validation were merged through PR #19. Migration `000005_patients.up.sql` adds patient demographics and optional supplied identity with database-generated canonical value and a unique type/canonical constraint. A must confirm the migration number; C reviews the schema; DEC02 still controls final fields and identity equivalence. `validation.go` mirrors the provisional normalization rule.

TASK-PAT-02 work on `member-b/registration-search` adds a service with parameterized pgx queries for registration, ID/name/identity/contact search, demographic updates with version checks, and database-arbitrated duplicate identity conflicts. Patient creation and correction write structured audit events in the mutation transaction; a failed audit rolls back the change. Search returns at most 25 records after each candidate passes the supplied record-access policy. A missing policy denies every operation. The integration test exercises synthetic optional identities, a concurrent duplicate race, Unicode and other searches, access filtering, stale updates and forced audit failure.

A's AUTH-03 integrates the existing service with reception-only demographics authorization and protected create/search/read/update handlers in the shared HTTP transport. Every operation checks account/role/record scope in its transaction; writes require same-origin session CSRF. Routes are wired only with explicit auth configuration. See [the implementation contract](../../../docs/api/auth-03-contract.md). No patient schema or business rules were changed for this handoff. A/C/F review, DEC02/07, PAT-03 screens and AT02 acceptance remain pending. The public OpenAPI publishes only reviewed endpoints; the contract packet describes these implemented development routes for review.
