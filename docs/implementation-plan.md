# AyurFlow implementation plan

This plan translates the 1 October 2026 team task plan and SRS v1.0 into build order for the current repository. The ten weeks are **relative to kickoff**. The SRS is a review baseline; clinic approval and real-data authorization are separate gates. Source locations are listed in [source-documents.md](source-documents.md). The task IDs below belong to the team plan; requirement IDs and AT IDs belong to the SRS.

## Product and boundaries

Build a single-clinic staff application from registration through consultation, one ordered care pathway, manual room/therapist booking, saved recipe preparation, **actual** botanical batch consumption, issued invoices and direct receipts. Authorized staff reports and audit history support that journey. Go/Gin owns rules and transactions; Next.js App Router uses `/api/v1`; PostgreSQL is the system of record through pgx/pgxpool.

The agreed reduced scope excludes public signup, automatic diagnosis, scheduling optimization, FEFO, stock reservation, recursive recipes, payment gateways, refunds/credit ledgers, multi-clinic tenancy and offline sync. Clinical clearance is based on plan/stage decisions, never invoice balance. Development, test and external AI work use synthetic records only.

## What exists now

The repo has API process/configuration, a pgx pool, health/readiness, a forward migration runner, identity/throttle/audit-integrity and patient migrations, a role catalog, Argon2id credentials, a synthetic staff seed, and optional login/session/logout routes. AUTH-03 adds shared session/CSRF middleware, transaction-scoped role/record policy and protected reception-only patient registration/search/read/update using B's existing audited service. Clinical/session access fails closed without a real module assignment adapter; their routes remain unregistered. The audit reader still requires a reviewed object-access adapter. Auth and patient routes require explicit DEC07 policy values and an HTTPS origin and are disabled by default. Only reviewed health/readiness paths are published in OpenAPI; the implemented development contract is in `docs/api/auth-03-contract.md`. Pilot deployment, full module journeys and backup/restore remain pending. `docs/testing.md` distinguishes implementation checks from acceptance results.

## Build sequence and dependencies

| Window | Deliverable and accountable owners | Integration proof |
| --- | --- | --- |
| Sprint 1, weeks 1–2 | A coordinates named tasks, DEC07, shared IDs/errors, schema/API and migration sequence (`TASK-SET-01/04/06`); A/F finish startup and shared UI; A builds auth/RBAC/audit foundation; B builds patient schema and registration; all owners review contracts. | Deployed login → register → search with direct API permission tests. Every member starts the app. |
| Sprint 2, weeks 3–4 | B builds consultation draft/sign/addenda and one plan/stage workflow; C builds availability, room/therapist bookings and assigned therapist actions; B/C implement one shared clearance and hold/start transaction contract. D/E proceed on agreed inventory/billing schema. | Consultation → approved current stage → conflict-safe booking → authorized session start, including two-request races. |
| Sprint 3, weeks 5–6 | D builds flat recipes, immutable preparation snapshots, manual batch selection, atomic consumption and traceability; E builds draft/issued invoices, labelled direct deposits/receipts and balance/retry rules; F joins screens/reports; every owner closes module tests. | Synthetic patient-to-receipt journey; stock and receipt rollback/retry evidence; feature freeze at end of week 6. |
| Sprint 4, weeks 7–8 | F coordinates UAT, 10-minute performance and viewport tests; A/F sweep permissions/audit; A completes daily encrypted backup and isolated restore; all owners fix their module defects. | AT01–AT16 evidence reviewed; no serious access or data-integrity defect remains. |
| Sprint 5, weeks 9–10 | A/F verify clean deployment/migration/seed/restart; owners finish guides; F coordinates training, release record and handover. | AT17 passes; named host, key, restore and support responsibilities and clinic review are recorded. |

Do not hold all integration until Sprint 3: use reviewed API examples and synthetic fixtures to build frontend screens early, then replace mocks with real endpoints. Dependencies may permit preparatory work, but a task is integrated and done only after its prerequisites and acceptance checks pass.

## Contracts to agree before feature endpoints

1. **Identity and API (A, all):** server-generated stored IDs; `/api/v1` resources; request/response schemas; bounded lists and stable pagination; 400/401/403/404/409/422 error rules; generic errors without patient disclosure. Define operation IDs and same-payload retry behavior for consumption/receipts. Record DEC07 expiry, throttling, recovery and CSRF settings.
2. **Data units (A with D/E):** UTC instants, Asia/Colombo display, integer LKR minor units and fixed-precision decimal grams. D/clinic settle gram scale, rounding and expiry before inventory acceptance; E/clinic settle tariff and receipt examples before billing acceptance.
3. **Module joins (owners):** patient → encounter/plan → stage/session → preparation/consumption; patient → invoice → receipt. Validate linked patient IDs in the backend. B/C agree the session-clearance interface and transaction order for hold/cancel versus start. The database should enforce foreign keys and action uniqueness.
4. **Ownership:** one migration sequence and one OpenAPI contract. Module owners add their own schema/endpoints/screens/tests; A resolves shared conflicts. Update `docs/api/openapi.yaml` when endpoints work and their permissions are reviewed, not merely proposed.

## Implementation rules by area

| Area | Owner | Required behavior and verification |
| --- | --- | --- |
| Identity/admin/audit | A with F on UI | Argon2id, controlled accounts, opaque hashed server sessions, expiry/revocation/throttling, CSRF, backend role **and record** checks. Administrator alone has no clinical-note access. Critical audit insert and mutation share a transaction; audit retrieval is restricted. AT01, AT13. |
| Patients/consultations | B | Optional NIC, normalized supplied-identity uniqueness including race, Unicode search, audited demographics. Consultation can exist without plan; signing locks original and dated addenda preserve it. AT02–03. |
| Clinical pathway | B with C | One ordered pathway, clinician approval, guarded stage advancement, reasoned hold/resume/cancel, completed-history retention and safe hold/start concurrency. An already started session may be completed during hold; new starts are blocked. AT04–05. |
| Scheduling | C with B | Room/therapist availability and `[start,end)` bookings with separate PostgreSQL overlap constraints. Atomic reschedule keeps old booking on conflict. Only assigned therapist starts/delivers after current-stage clearance. AT06–07. |
| Inventory/preparation | D with E reviewing retries | Positive fixed-precision batches; block/expiry eligibility; flat recipe scaling; immutable saved snapshot with **no deduction**; manual eligible batch selection; atomic actual consumption, uniqueness, safe retry and bidirectional traceability. AT08–11. |
| Billing | E with D reviewing retries | Draft edits; atomic issue locks invoice lines and total; one-invoice positive receipts including labelled deposits; no overpayment; receipt operation uniqueness and safe concurrent posting; derived balance and outstanding report. AT12–13. |
| Reports/UI/integration | F, with each module owner | Shared controls and role-specific navigation; reports from committed records with role/record restrictions; complete walkthrough; keyboard/Unicode and target viewport evidence. AT11, AT13–15. |
| Deployment/operations | A with F | HTTPS, restricted DB/secrets, repeatable Compose, numbered migrations, synthetic seed, encrypted off-host daily backup, isolated restore, outage/re-entry procedure and named handover. AT16–17. |

For each feature: implement a working vertical slice in its module (`handler.go`, `service.go`, `repository.go` as needed), add a new numbered SQL migration, enforce permissions in Go, add the critical audit event in the same transaction, integrate the feature screen, update OpenAPI and prove the named acceptance behavior. Parameterize SQL. Retain history; do not simulate corrections by editing confirmed records.

## Decision gates

| Decision | Owner / gate | Work that must wait for agreement |
| --- | --- | --- |
| DEC01 | Team/clinic/supervisor, week 1 | Confirmed clinic identity and formal review record. |
| DEC02 | B/clinic clinician, weeks 1–2 | Final patient/consultation fields, clinical record policy, one pathway and completion checklist. |
| DEC03 | D/clinic dispensary, before inventory UAT | Recipe examples, gram scale/rounding, expiry treatment and external discrepancy process. |
| DEC04 | E/clinic billing, before Sprint 3 acceptance | Tariffs, issue/deposit timing, rounding, receipt fields and external financial correction. |
| DEC05 | Clinic/institution, before real-data pilot | Authorization, retention, report/export rules and access responsibility. |
| DEC06 | A/clinic, before handover | Host/funding, backup/key custody, monitoring, restore owner and support contact. |
| DEC07 | A/team, Sprint 1 | Session expiry, throttling, recovery, action/error API contract. |
| DEC08 | Team/clinic, before SRS approval | Resume/cancel, assigned therapist start, completion during hold, availability and concurrency rules. |

Record approved decisions in `docs/decisions.md` with reviewer and date. A technical placeholder is not clinic approval. Changes to workflow, access, money, stock or dates need the SRS change record and relevant reviewer.

## Verification and release gate

Use `scripts/check.ps1` for repository checks and real PostgreSQL integration tests for booking, stock, receipts and clinical transitions. `tests/fixtures` holds synthetic data; `tests/integration` and `tests/e2e` hold evidence-producing cases. For each AT01–AT17 result, record setup, steps, expected/actual result, tester, date, app version, environment and evidence path. F coordinates coverage; each owner tests their own feature. AT14 requires 5 concurrent simulated staff for 10 minutes with 500 patients, 1,000 sessions and 200 batches; patient search, availability and invoice retrieval each need p95 under 2 seconds. AT15 checks 1366×768 and 1024×768, keyboard focus, labels, Unicode and errors.

Pilot acceptance needs the full synthetic journey, passing role/record access, booking/consumption integrity, measured performance/usability, isolated restore and clinic review. Record unresolved lower-priority defects; do not mark failed tests passed. Real patient use waits for DEC05 regardless of technical acceptance.
