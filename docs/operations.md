# Administration and operations runbook

**Task:** TASK-OPS-03, Member A's portion · **Owner:** A · **Reviewer:** F · **Requirements:** IAM-01–05, ADM-01 and AUD-01–02 support · **Acceptance:** AT16 outage procedure and AT17 setup/documentation support

This runbook covers the current synthetic-development application. The [staff administration guide](guides/member-a-administration.md) covers account operations; the [patient/clinical guide](guides/member-b-staff.md) covers B's workflows. F assembles the other owners' guides. Live deployment, clinic review and full AT acceptance remain open. Real-data use requires DEC05 regardless of technical checks.

## Setup and first synthetic sign-in

1. Follow the [root README](../README.md) for Docker startup or separate Go/Next.js processes and the [toolchain guide](ci-and-test-guide.md#frontend-toolchain-and-lockfile-recovery) for the pinned versions. Root Compose is development-only: it binds ports to localhost, uses the database owner and leaves authentication disabled. Starting it alone does not provide a working staff sign-in.
2. Apply repository migrations before starting the API. See [database instructions](../backend/db/README.md). Go reads process environment variables; it does not automatically load `.env` files. Next.js reads `frontend/.env.local`.
3. For Go commands, supply either `DATABASE_URL` or `DATABASE_URL_FILE`, never both. The file contains only the DSN and must be protected outside Git. Frontend `BACKEND_URL` points to the backend; database credentials never belong in frontend settings.
4. Bootstrap an isolated development database using the [synthetic seed instructions](../backend/db/seeds/README.md). Explicitly set `APP_ENV=development`, `SEED_STAFF_LOGIN`, `SEED_STAFF_PASSWORD` and `SEED_STAFF_ROLES=administrator`, with the database configuration above. From `backend/`, run `go run ./cmd/seedstaff`; inspect its exit status. Clear `SEED_STAFF_PASSWORD` from the invoking shell afterward. Repeating a login makes no change and cannot reset its password or roles. No default account is created.
5. Before starting an authenticated API, explicitly supply every setting below from [the backend example](../backend/.env.example). Use selected synthetic-test values and record them; DEC07 release review remains pending. For separate local processes, use a trusted development HTTPS certificate following the [login setup](api/auth-04-login.md#development-setup). Root Compose does not pass these auth settings to its backend merely because they exist in `.env`; use the documented local-process setup or separately configured pilot candidate.

| Setting | Required meaning |
| --- | --- |
| `AUTH_ENABLED` | `true` to enable the implemented auth and protected feature routes; leave unset for health/readiness only. |
| `AUTH_ALLOWED_ORIGIN` | Exact HTTPS frontend origin, including its port if used, without a trailing slash/path. |
| `AUTH_IDLE_TIMEOUT` / `AUTH_ABSOLUTE_TIMEOUT` | Positive durations; idle cannot exceed absolute. |
| `AUTH_ATTEMPT_LIMIT` | Integer from 1 to 100; chosen explicitly for the environment. |
| `AUTH_ATTEMPT_WINDOW` / `AUTH_BLOCK_DURATION` | Positive durations for identifier throttling. |

6. Start the API and frontend, check health/readiness, then sign in with the synthetic administrator. Create separate role accounts through **Staff administration**, following the [staff guide](guides/member-a-administration.md). Administrator alone cannot perform patient registration. Use a receptionist for the registration/search journey.

Secure cookies require HTTPS. Do not disable cookie protection or the synthetic seed's development guard to work around setup failures. Initial production administrator provisioning and account/password recovery remain DEC07 gates; the seed is not a pilot bootstrap procedure.

## Pilot configuration and migrations

Use [the pilot operator procedure](../deploy/README.md) for the standalone `deploy/compose.pilot.yaml`, HTTPS proxy, separate migration/application credentials, secret files and runtime grants. Do not combine it with development Compose. That document is the authoritative command sequence for this candidate; host/DNS/firewall, credential provisioning, DEC06 and live F verification are still required.

For an authorized schema update:

1. Record the selected commit/version and review the new migration filenames with affected owners. Obtain a verified backup/recovery plan before a pilot schema change; OPS-02 remains unimplemented, so this is still a deployment gate.
2. Stop application traffic and writers for the maintenance window. Build the chosen release before running its migrations. For separate local development, stop the Go/Next.js processes; from `backend/`, run `go run ./cmd/migrate` with the intended environment. Check a zero exit status and **Migrations applied** before starting the API.
3. For the pilot, run the explicit maintenance-profile migration service and the reviewed runtime-grant script as described in [deploy/README.md](../deploy/README.md#configure-and-start). Do not start the API if either fails. New tables need an explicit grant-script review.
4. The runner applies pending filenames in order and records complete paths in `schema_migrations`. The pending batch shares a transaction; failures roll it back. Re-running skips committed filenames. Keep both existing `000004` filenames; never rename or edit an applied migration or manually mark a failed one applied.
5. After success, start the selected application version and verify readiness and the authorized synthetic journey. A previous application version may be incompatible with the new schema; do not automatically roll it back. Preserve data and use a reviewed forward fix or a separately tested recovery procedure.

In local development, `docker compose up --build -d` follows the root Compose database/migration dependencies. Review `docker compose ps -a` and the migration service's outcome; a healthy database alone does not prove successful migrations.

## Diagnose availability and preserve data

For local development, from the repository root:

```powershell
docker compose ps -a
docker compose logs --tail 100 migrate backend frontend
Invoke-RestMethod http://localhost:8080/api/v1/health
Invoke-RestMethod http://localhost:8080/api/v1/ready
```

For a configured pilot, use its protected operator settings file and standalone Compose file as in the deployment procedure, and the HTTPS `/api/v1/health` and `/api/v1/ready` URLs. Do not paste secret files, rendered Compose configuration or unredacted logs into tickets.

| Observation | Meaning and next action |
| --- | --- |
| Health returns 200 | The API process responds. This does not prove database, migrations or feature readiness. |
| Readiness returns 200 | Database ping succeeded. Verify migrations, grants, configuration and the relevant journey separately. |
| Readiness returns 503 | Inspect database availability, TLS/network access and the protected connection configuration. Preserve data; do not initialize a replacement database over it. |
| Browser cannot sign in | Check exact HTTPS origin, certificate trust, all explicit auth settings and backend connectivity. A 404 can mean auth routes are disabled. |
| Generic invalid credentials | Check account status and the configured throttle window through an authorized administrator/operator. Do not print credentials or bypass throttling. |
| Forbidden mutation | Reopen the session and check current roles, record access and CSRF. Do not grant extra roles or disable checks as a repair. |
| Mutation times out or returns an uncertain outcome | Inspect current committed state before retrying. A response failure does not establish rollback. |

For an ordinary development stop/start without a schema update, `docker compose stop` followed by `docker compose up -d` preserves the database volume. Pilot restart preserves the external database and must also retain Caddy's persistent volumes. Do not use `docker compose down -v`, delete volumes or remove committed rows as an outage remedy. Restart persistence is not backup/restore evidence.

## Outage and controlled re-entry

1. Record the outage start time/timezone, affected functions, operator and version. Tell the responsible clinic/team contact which actions are unavailable. Restrict traffic if access or data integrity is in doubt.
2. Staff use the clinic-approved paper workflow only after that process and custody are agreed. Keep paper records in the approved secure location. There is no offline synchronization or approved paper template supplied by this application.
3. Diagnose and repair using redacted status/logs, preserving the last committed state. Database restoration must follow a tested, approved recovery procedure; none is implemented yet under OPS-02. Do not improvise a restore or reverse applied migrations.
4. Before resuming, the operator and relevant module owner check health, readiness, migrations/grants, sign-in and an authorized synthetic smoke journey. Record service return time and obtain the responsible workflow owner's agreement to resume.
5. The designated staff member reconciles paper entries against current saved records before re-entry, including writes whose original result was uncertain. Use normal authorized, validated and audited forms. Receipts and consumption must use their supported operation-ID retry rules; do not invent a second operation to bypass an uncertain result.
6. Preserve the original event time/reference through the owning module's supported fields and the approved paper record. If no field supports it, record the gap for the module owner and follow the agreed external reconciliation process; do not change system timestamps, signed/issued history or database rows directly.
7. Have a second authorized reviewer compare the re-entered records with the paper record, record discrepancies and corrections, and close the incident only after reconciliation. Retain/destroy paper under the approved retention procedure, which remains DEC05 work.

## Deferred operational decisions

The user deferred backup/storage and key-custody work until deployment on 31 October 2026. OPS-02 remains pending: daily encrypted off-host backups, separate key custody, monitoring and an isolated restore of a patient, batch, invoice and audit event still need implementation and AT16 evidence. A local dump or container restart does not close this task.

Before pilot/handover, record DEC06 host/funding, backup/key custody, restore operator, monitoring and support contacts; DEC07 production bootstrap/recovery; and DEC05 real-data authorization/retention/export responsibility. Keep unresolved items open in [the decision register](decisions.md). No host, backup target or recovery promise is selected by this runbook.

## OPS-03 walkthrough and handover

Member F or another named member must follow setup/migrations, synthetic sign-in, account creation/role change/disable, failure handling and the outage/re-entry procedure in a disposable environment. Use a rehearsal for steps needing a clinic paper process; mark unavailable steps pending. Do not interrupt a shared deployment to create an outage test. The broader AT17 clean-start/restart evidence belongs to OPS-04, and the isolated restore belongs to OPS-02/AT16.

Copy this record into [testing.md](testing.md) when executing the walkthrough:

| Field | Result to record |
| --- | --- |
| Task / acceptance scope | TASK-OPS-03 (A); related AT01/AT13/AT16/AT17 steps actually exercised |
| Version / environment | Commit, date, OS, toolchain, database, HTTPS origin; redact secrets |
| Tester / reviewer | Names and execution/review dates |
| Setup | Isolated synthetic database/accounts and configuration; no secret values |
| Steps | Actual commands/screens used; include migration repeat, role changes and failure recovery |
| Expected / actual | Per-step outcome, including what remained pending or failed |
| Evidence / defects | Redacted evidence links and open defect IDs |
| Handover | Named recipient, support owner and outstanding DEC05/06/07 responsibilities |

Use [published OpenAPI](api/openapi.yaml) for reviewed operational endpoints and the [API review packets](api/README.md) for implemented development contracts awaiting review. Documentation and CI checks do not establish clinic approval, operational recovery or pilot readiness.
