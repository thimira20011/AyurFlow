# Architecture baseline

Browser → Next.js App Router → `/api/v1` Go/Gin modular monolith → PostgreSQL through pgx v5/pgxpool. Six functional modules share one application and database. Auth and audit are cross-module foundations. No Redis or gateway SDK is required.

Within a module, `handler.go` translates transport inputs/results, `service.go` enforces authorization, workflow and transaction boundaries, and `repository.go` implements parameterized database access. Introduce these files with working behavior rather than empty methods. Shared clinical clearance is an explicit service contract between clinical and scheduling.

Patient → encounter/plan → session → preparation → actual batch consumption provides traceability. Patient → invoice → receipt is the billing path. Clinical clearance never depends on invoice balance. Reports use committed records and restricted fields.

Store instants in UTC and display Asia/Colombo. Money uses integer LKR minor units; grams use fixed-precision decimals with scale/rounding pending DEC03. Server-generated stored IDs and operation IDs for consumption/receipt retries require database uniqueness. Booking intervals use `[start,end)` and database exclusion constraints for room and therapist separately.

Implemented foundation: API configuration, pgx pool, liveness/readiness, a migration runner, identity/audit storage, role catalog, shared frontend shell and six planned module pages. Business routes, credentials, permissions, audit immutability, module schemas, transaction services and reports are pending. The presence of a role or session table does not establish working security.

Versions are pinned in package manifests and Dockerfiles. Next.js 16.3.8 was selected against the [September 2026 security release](https://nextjs.org/blog). Go dependencies use the current official module registry releases at scaffold creation. Update pins deliberately and verify the application after updates. Container image digests and production role separation remain release tasks.

The Next.js React ESLint plugin currently declares compatibility through ESLint 9; ESLint 9.39.5 is pinned so lint checks work without overriding peer requirements. The registry marks that release unsupported. Review an upstream-compatible lint-toolchain update during Sprint 1 before pilot delivery.
