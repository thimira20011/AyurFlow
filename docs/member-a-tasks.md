# Member A task list

**Role:** shared Go/API foundation, authentication, role and record access, audit mechanism, deployment and backups. **Review partner:** Member F. Weeks below are relative to implementation kickoff, not calendar dates. A checked box means Member A's implementation and local checks are complete. Final task acceptance still requires the stated integration evidence and reviewer; record those separately rather than implying they passed.

Sources: *AyurFlow Team task plan* (1 October 2026), especially pp. 2–5 and 11–14; *AyurFlow SRS* v1.0, especially pp. 4–6, 13, 17–21. See [the implementation plan](implementation-plan.md) for dependencies and release gates.

## Current completion summary — 28 October 2026

### Implemented

| Member A work | Implementation state | Review/acceptance still required |
| --- | --- | --- |
| AUTH-01 credentials/synthetic seed | Implemented and merged | Seed repeat evidence/F review, full AT01 |
| AUTH-02 sessions | Implemented and merged, including fresh clock audit fix | DEC07/F review and full AT01 |
| AUTH-03 shared authorization | Implemented and merged with patient integration | Real module assignment/report/export policies, DEC02/07 and full AT01/13 |
| AUTH-04 login and staff administration | Implemented and merged through PRs #30/#31 | F/browser/AT01 review, recovery policy pending |
| AUTH-05 shared audit | Implemented and merged | Each module's critical calls/retrieval permission adapter and full AT13 |
| Shared CI/toolchain and three audit fixes | Implemented and merged | Ongoing checks with incoming features; not AT acceptance |
| OPS-01 pilot configuration slice | Implemented and pushed on `codex/ops-01-pilot-config`; all five CI jobs passed | Host/DNS/database configuration, deployed journey and F review; full OPS-01 remains open |

### Remaining Member A tasks

- **Next security verification:** AUTH-06 — complete AT01 with role accounts, browser/direct API access, CSRF, expiry/throttling, safe logs and F review.
- **Deployment and recovery:** OPS-01 HTTPS/restricted credentials; OPS-02 encrypted backups/isolated restore; OPS-03 guides/outage runbook; OPS-04 clean startup/persistence; OPS-05 host/key/support decisions; OPS-06 training/handover.
- **Integration reviews:** QA-02 report access; QA-04 module audit/permission sweep; QA-05 host/performance support. Owners still integrate their own real record policies and audit calls.
- **Coordination/evidence:** SET-01 named ownership; SET-04 reviewed API/security conventions; SET-05 every member's startup proof; SET-06 reviewed module schema/API boundaries. The shared setup implementation alone does not complete these coordination tasks.
- **Gates:** DEC02 clinical permissions/fields, DEC05 real-data authorization, DEC06 operations, DEC07 final security/recovery policy; other owners' DEC03/04/08 choices still affect integration. No pending decision is marked approved by code completion.

## Baseline and branch status (26 October 2026)

- The Go/Gin API, pgx pool, numbered migration runner, `/api/v1/health` and `/api/v1/ready` exist. Next.js has a shared shell and placeholder module pages. Compose and CI/check scripts exist.
- Migrations `000001`–`000005` provide identity, roles, sessions, audit, billing and patient storage. Preserve both merged `000004` filenames. Merged AUTH-03 adds shared role/record enforcement and a protected patient-demographics slice; real module assignment adapters remain pending.
- OpenAPI publishes reviewed health/readiness; the AUTH-03 packet describes implemented development auth/patient routes for review. A synthetic staff seed exists. Other business routes, HTTPS pilot deployment, backup automation and restore evidence remain pending.
- `TASK-SET-05` is **in progress**: each member must still demonstrate local startup. AUTH-01, AUTH-02, AUTH-03 and AUTH-05 are merged. AUTH-04 implementation is pushed for review on the two branches above; AUTH-06, pilot operations and full AT01–AT17 acceptance remain pending.
- **AUTH-04 CI:** [login workflow](https://github.com/thimira20011/AyurFlow/actions/runs/40226412067) and [staff workflow](https://github.com/thimira20011/AyurFlow/actions/runs/40227744450) passed backend, frontend, security and PostgreSQL integration jobs. Staff CI executed 81 integration cases with race detection and no skips. This does not close browser/UAT or reviewer acceptance.

### TASK-SET-05 CI repair slice

- [x] **Toolchain consistency (24 October):** pin Node 22.23.2/npm 10.9.8, enforce install engines, align CI/Docker, add a version-manager file and lockfile recovery instructions on `codex/frontend-toolchain-consistency`. Owner A; reviewer F. This is SET-05 setup maintenance, with no business/SRS behavior change. Verification is recorded in [testing.md](testing.md); full SET-05 acceptance remains open.

- [x] Repair merged build/lockfile defects, receipt retry/concurrency/overflow defects, and shared audit integration on `codex/dev-ci-integration-fixes`. Add automatic discovery of incoming module tests, isolated PostgreSQL fixtures, migration regressions, skipped-test rejection, static analysis and vulnerability scanning. Upgrade Go and affected dependencies. Local checks passed; remote results are recorded in [testing.md](testing.md). Owner A; reviewer F, with E/D review for billing behavior. Full SET-05 and AT acceptance remain open.

## Weeks 1–2: contracts and first deployed flow

- [ ] **TASK-SET-01 — coordinate ownership and reviews.** Put all 64 task IDs on one board with a named owner, reviewer, status and evidence link; record weekly integration and two-week sprint reviews. A coordinates; every member confirms their tasks. **Done:** no task has an anonymous owner or reviewer.
- [ ] **TASK-SET-04 — settle shared API and security conventions (DEC07).** Review ID formats, UTC instants and Asia/Colombo display, integer LKR minor units, decimal grams policy handoff, pagination, error envelope/status codes, operation-ID retry behavior, cookie/CSRF contract, session idle and absolute expiry, throttling and recovery. Write request/response examples and decisions in `docs/decisions.md` and `docs/api/`. **Done:** all owners review the contract; pending clinic choices stay marked pending.
- [ ] **TASK-SET-05 — finish the scaffold.** Verify Go/Gin, Next.js, migrations and checks on every member's machine; provide repeatable, synthetic-only seeds once identity and patient fields are ready. Resolve actual setup failures. **Done:** each member demonstrates local startup; `scripts/check.ps1` passes; instructions and evidence are recorded. F assists.
- [ ] **TASK-SET-06 — coordinate schema and OpenAPI boundaries.** Collect each module owner's fields, foreign keys, actions, permissions and errors; agree migration numbers and inter-module IDs. A coordinates; each owner writes their own module contract/migration. **Done:** reviewed logical schema, API examples and migration order; no undocumented cross-module assumptions.
- [x] **TASK-AUTH-01 — finish account/role/session foundation.** The existing schema was reviewed; Argon2id create/verify and an explicit development-only synthetic staff seed were implemented on branch `codex/auth-01-password-seed` (commit `8277cc7`). Go format, vet, unit tests and builds pass; no plaintext or default credential is committed. **Acceptance pending:** run the seed and its repeat case against PostgreSQL, then obtain F's review. This is implementation complete, not AT01 passed.
- [x] **TASK-AUTH-02 — implement sessions.** Merged into `dev` through PR #12 (`812a93f`). Login/logout/session lookup, hashed opaque tokens, expiry, revocation, disabled-account rejection and PostgreSQL-backed identifier throttling are implemented. The [merged workflow](https://github.com/thimira20011/AyurFlow/actions/runs/39788040138) passed, including the PostgreSQL lifecycle test. Auth routes require explicit DEC07 configuration. **Acceptance pending:** DEC07/F review, review/merge of account-disable wiring in TASK-AUTH-04 and full AT01 evidence.
  - [x] **Session clock audit fix:** `codex/audit-session-expiry` checks expiry after pool/row-lock waits for all session paths and uses fresh login timestamps. Deterministic PostgreSQL regressions are added; local unit/vet/build and integration compilation passed. Real database/race execution and F review remain pending. See [audit inventory and evidence](audits/session-expiry.md).
- [x] **TASK-AUTH-03 — shared authorization implementation.** On `codex/auth-03-authorization`: session/CSRF middleware, non-rotating protected request validation, current database role/active-account checks in the business transaction, fail-closed record-assignment interface and reception-only patient route integration. The user approved provisional synthetic access rules on 24 October and retained explicit DEC07 configuration. Direct API/database tests cover forbidden requests, clinical admin denial, revocation/expiry, retries of CSRF-protected requests and audit rollback. **Acceptance/handoffs pending:** F review, B/C patient handoff, actual clinical/therapist assignment adapters, module-specific report/export/audit policies, DEC02/07 and complete AT01/AT13. No unimplemented module route is exposed. See [integration instructions](../backend/internal/authorization/README.md) and [evidence](testing.md).
- [x] **TASK-AUTH-05 — transactional audit foundation.** Implemented on `codex/auth-05-audit`: caller-transaction writer with rollback on failure, bounded structured metadata/changed-field names, append-only PostgreSQL protection and object-scoped reads requiring an explicit authorization adapter. Go tests, vet, builds and [PostgreSQL/race CI](https://github.com/thimira20011/AyurFlow/actions/runs/39791162419) pass. See the [module integration instructions](../backend/internal/audit/README.md) and [verification evidence](testing.md). **Acceptance pending:** F review, AUTH-03 authorization/route integration, each module's audit calls and full AT13. No audit route/UI is exposed before those permission gates.
- [x] **TASK-AUTH-04 — account and role UI implementation.** Login/session/logout, administrator account creation/listing, explicit role assignment and audited disable/session revocation merged through PRs #30/#31. Self-lockout and concurrent administrator changes are protected. See [login](api/auth-04-login.md) and [staff](api/auth-04-staff.md) contracts. **Acceptance pending:** F/browser review, full AT01 and DEC07 recovery/production policy. No public signup is implemented.
  - [x] **Login slice (26 October):** working sign-in, session restore/expiry handling, honest logout and role-aware workspace navigation on `codex/auth-04-login`; [implementation/checks](api/auth-04-login.md). Administrator account-management slice and F/AT01 acceptance remain separate.
- [ ] **TASK-OPS-01 — deploy the first slice.** Extend development Compose into a reviewed pilot configuration with HTTPS reverse proxy, restricted database access, separate application/migration credentials and secrets outside Git. Pair with B/F on the login → patient registration → search demonstration. **Done:** deployed Sprint 1 journey works with permissions; F verifies. Pilot host choices remain under DEC06.
  - [x] **Pilot configuration implementation (28 October):** separate Compose candidate, proxy-only published ports, separate file-mounted database secrets, explicit auth configuration, runtime-grant script and PostgreSQL privilege regressions on `codex/ops-01-pilot-config`. [All five CI jobs passed](https://github.com/thimira20011/AyurFlow/actions/runs/40639877368), including Compose/Caddy validation and real PostgreSQL/race checks. See [setup and gates](../deploy/README.md). Deployment, HTTPS/firewall proof and F acceptance remain open; this is not a completed OPS-01 deployment.
  - [x] **Request lifecycle audit repair:** bound application request contexts to 10 seconds within the 15-second write window; preserve graceful drain, then cancel/close stalled requests before pool cleanup. Implemented on `codex/audit-request-lifecycle`; focused cancellation/shutdown tests pass. [Evidence and limits](audits/request-lifecycle.md). Owner A, reviewer F; full OPS-01/deployment acceptance remains open.

## Weeks 2–3: administration, audit and identity verification

- [ ] **TASK-AUTH-06 — prove identity and logging behavior.** Execute AT01 with named role accounts, direct forbidden requests, CSRF, expiry, throttling and safe-log checks. F reviews. **Done:** AT01 evidence records setup, steps, actual results, version and reviewer; failures remain open defects.
  - **In progress (28 October):** mapped existing automated coverage, added error/panic confidentiality regressions and wrote the [browser/direct API verification procedure](auth-06-verification.md) on `codex/auth-06-verification`. Full AUTH-06 remains unchecked pending current-version execution evidence, browser checks and F review.

## Weeks 4–8: integration and reliability

- [ ] **TASK-QA-02 (access reviewer).** Review F's report navigation and D/E's report endpoints for role, record and filter restrictions. **Done:** AT11/AT13 report checks expose only authorized fields.
- [ ] **TASK-QA-04 — audit and permission sweep with F.** Collect each owner's critical actions and test clinical, booking, inventory and billing audit events and direct API boundaries. **Done:** AT13 passes, including failed-audit rollback and preserved history.
  - [x] **Patient snapshot audit fix:** replace separate patient/identity reads with one committed statement snapshot; add deterministic concurrent audited-update and nullable-identity regressions on `codex/audit-patient-snapshot`. Owner A, reviewer F with B/C handoff; [verification and limits](audits/patient-snapshot.md). Full QA-04/AT13 acceptance remains open.
- [ ] **TASK-QA-05 (host support).** Supply the declared pilot host/configuration for F's AT14 workload and help diagnose host issues; module owners fix their query paths. **Done:** 10-minute, 5-user run on 500 patients/1,000 sessions/200 batches records per-operation p95 and errors; target is under 2 s for all three named reads.
- [ ] **TASK-OPS-02 — encrypted daily backups and isolated restore (DEC06).** Agree off-host storage, separate key custody, monitoring and restore owner; automate backups and test an isolated restore of a patient, batch, invoice and audit event. **Done:** AT16 evidence records backup age, measured restore duration and inspected records. F/clinic reviewer validates operations.

## Weeks 8–10: clean release and handover

- [ ] **TASK-OPS-03 (A's portion).** Maintain API/setup/migration instructions and the operational outage/re-entry procedure; every owner writes their module guide, F assembles them. **Done:** another member follows the instructions successfully.
- [ ] **TASK-OPS-04 — clean startup and persistence with F.** From an isolated clean environment, apply migrations, load synthetic seeds, restart and verify committed records persist. **Done:** AT17 evidence includes commands, versions, outcomes and reviewed OpenAPI/guides.
- [ ] **TASK-OPS-05 (operations portion).** Record host/funding, backup/key custody, restore owner and support contact under DEC06. Support the team lead/clinic/institution on DEC05 real-data authorization, retention and exports. **Done:** decisions are recorded before pilot/handover; technical completion never implies real-data permission.
- [ ] **TASK-OPS-06 (A's portion).** Teach administration, account recovery and operations in F's training/handover; supply runbook, limitations and support details. **Done:** named recipient, release version, acceptance evidence and responsibilities are recorded.

## Gates and handoffs to track

- **DEC02 (B/clinic):** patient fields and clinical record access are required before finalizing record authorization. **DEC03/04 (D/E/clinic):** units and billing rules must be reflected in shared formats. **DEC05:** required before real patient data. **DEC06:** required before operational handover. **DEC07:** A/team Sprint 1 security/API settings. **DEC08:** plan/session concurrency contract with B/C.
- Give B–E a usable session/authorization/audit contract early. Each feature owner integrates its own migration, UI, permission checks, audit calls and tests; A reviews shared conflicts rather than implementing all module schemas.
- Use `AT01`, `AT13`, `AT16`, `AT17` as A's primary acceptance evidence. Contribute host evidence to `AT14` and permission review to `AT11`. F is the reviewer for A-owned work.
- The Sprint 1 exit is deployed login → registration → search; Sprint 2 is approved plan → safe booking → authorized start; Sprint 3 is the full synthetic patient-to-receipt journey and feature freeze; Sprint 4 is UAT and integrity/restore evidence; Sprint 5 is clean delivery and handover.
