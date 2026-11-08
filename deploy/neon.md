# Neon synthetic environment

TASK-OPS-01, owner A, reviewer F pending. SRS IAM-01–05 and AUD-01–02, supporting AT01/AT17. Dependencies are the existing migrations through `000013`, runtime grants and explicit synthetic authentication settings. Deployment and final security policy acceptance remain open.

## Linked resources and credentials

The workspace is linked to organization `org-sweet-rice-02567127`, project `small-heart-76292130`, branch `production` (`br-broad-dew-aogjfs8z`). The selected database was empty before setup. It now contains AyurFlow's schema and synthetic verification records. The branch name does not settle the real-data release gates.

`neon.ts` declares the Postgres-only setup created by `neon init`. The local `.neon` link and `.env.local` are ignored by Git. `neon deploy` pulls `DATABASE_URL`, `DATABASE_URL_UNPOOLED` and `NEON_BRANCH`. Those owner URLs are administrative credentials.

Separate SQL-created roles provide the app connections. `ayurflow_migrator` owns the application schema/tables and runs forward migrations. `ayurflow_app` receives the explicit runtime grants and uses Neon's pooled connection. Both roles lack superuser, database/role creation, replication and RLS bypass rights. The administrator installed the required `btree_gist` extension before migration. Database PUBLIC access was revoked for this dedicated database. The two application URLs use `sslmode=verify-full`.

Additional ignored local settings are `AYURFLOW_MIGRATION_DATABASE_URL` (direct) and `AYURFLOW_DATABASE_URL` (pooled). `scripts/neon-backend.mjs` selects the matching credential for each command and removes the administrative/migration URLs from the API child environment. Keep the default owner credentials out of hosted API/frontend settings. The existing pgx v5/pgxpool driver remains in the Go backend.

## Commands

Run from the repository root with the documented Node and Go toolchains. Install frontend dependencies in `frontend/` as described in the root README if needed.

```powershell
neon deploy
npm run db:migrate
npm run build
# Separate terminals
npm run dev:api
npm start
```

The launcher loads `.env` when present, otherwise `.env.local`. Existing process environment settings take precedence. Keep the two restricted URLs with the selected file when switching. A subsequent Neon env pull refreshes Neon-managed keys and retains the additional AyurFlow settings.

`npm start` serves the built frontend over HTTP. Secure-cookie login requires the HTTPS origin configured in `AUTH_ALLOWED_ORIGIN`. Use the existing [development HTTPS procedure](../docs/api/auth-04-login.md#development-setup) or the [pilot HTTPS configuration](README.md). The verification below used an isolated loopback HTTPS proxy with a temporary certificate. Local `APP_ENV=development` and the explicitly selected 5-minute idle, 1-hour absolute expiry, 3 attempts per 5 minutes and 5-minute block settings are synthetic-test configuration. DEC07 release policy remains pending.

## Tooling changes

The requested global CLI installation installed Neon 8.17.1. `neon init` automatically installed the user-level `neon-postgres` plugin for Claude Code, Codex and VS Code. For the other detected agents it installed the seven Neon skills and configured OAuth MCP at `https://mcp.neon.tech/mcp`. The installer reported user configuration writes to `.gemini/config/mcp_config.json`, `.gemini/settings.json`, `.copilot/mcp-config.json` and `.junie/mcp/mcp.json`. Codex uses the enabled plugin's bundled MCP configuration. User-level skills cover this workspace, so duplicate project installations were unnecessary. `neon skills status --global` reported all seven skills up to date.

The project additions are `neon.ts`, root `package.json`, the updated root lockfile, the `.neon` ignore rule, the backend launcher and this guide. Root scripts delegate frontend build/start/dev to its existing package. Local verification artifacts and generated credentials are under ignored `.cache/neon-setup/`. No credential values belong in commits or shared logs.

## Execution evidence — 4 November 2026

Tester Codex automation, Windows, Node 22.23.2, npm 11.4.1, Go 1.27.1, Neon CLI 8.17.1, Next.js 16.3.8. Code baseline `d820ae5` plus this setup on `codex/neon-postgres-setup`. The repository's documented target npm/Go versions remain 10.9.8/1.27.3.

The requested init linked the project offline, then browser OAuth completed during `neon deploy`. Deploy reported `Utilized services: Postgres`, no policy changes and three variables pulled. A final `neon config plan` reported no changes.

`npm run db:migrate` exited 0 and reported `INFO Migrations applied` on a repeat run. `npm run build` exited 0 with the following output.

```text
Compiled successfully in 2.8s
Finished TypeScript in 3.0s
Generating static pages using 19 workers (18/18)
Finalizing page optimization ...
```

The local verification started the production-built Next.js server and real Go API using the restricted application account, then drove Chromium over HTTPS. Expected and actual results matched.

```text
PASS: pooled application connection uses verified TLS and can read patients
PASS: application role cannot rewrite audit history or read migration history
PASS: production Next.js -> Go API -> Neon readiness returned HTTP 200
PASS: real Chromium sign-in and secure cookie session backed by Neon
PASS: authenticated patient registration HTTP 201 and persisted search HTTP 200
PASS: anonymous access and missing-CSRF writes rejected
PASS: after app shutdown, Neon retains exactly one synthetic patient and its patient.created audit event
```

Two random synthetic accounts (administrator/receptionist) and one synthetic patient were created. Account credentials are stored locally in ignored `.cache/neon-setup/accounts.json`. Test servers were stopped after verification. Command scripts and private process logs are in that ignored directory.

The temporary bootstrap helper initially had a missing return statement and was corrected before execution. The first restricted migration then failed with PostgreSQL `42501` on `CREATE EXTENSION btree_gist`. The migration transaction rolled back. Installing the required extension as administrator and rerunning with the migration role resolved it. The web-fetch tool failed to read the supplied skill URL, so PowerShell fetched that exact URL successfully. A skills-status call without network access failed and the permitted network retry passed. Init also warned that its Copilot CLI probe failed with `EINVAL`, then completed the skills/MCP fallback. Next.js emitted its existing standalone-mode warning for `next start`; the built frontend and browser verification completed successfully.

The initial local execution verified Postgres wiring with synthetic data. Public deployment verification is recorded below. Backup/restore, reviewed production account bootstrap, team/F review and full AT01/AT17 acceptance remain pending.

## Public Render smoke verification — 4 November 2026

After the user deployed both services and enabled explicit auth settings, Codex automation tested `https://ayurflow-frontend-l65w.onrender.com` with the real API at `https://ayurflow-tx05.onrender.com`. Environment was Windows/headless Chromium with normal public certificate validation, the existing synthetic administrator/receptionist accounts and the linked Neon database. The services were deployed from `dev`; the exact Render deployment commit was not collected. These results support OPS-01 and AUTH-06 evidence. Full acceptance and the unresolved backup/recovery and review gates remain open.

Expected and actual results matched for the following checks.

| Check | Actual result |
| --- | --- |
| Frontend API/database readiness | HTTP 200 |
| Anonymous session, patient and staff requests | HTTP 401 |
| Browser receptionist login and page refresh | HTTP 200 login, workspace retained, Secure/HttpOnly/SameSite=Lax cookie |
| Receptionist staff access, missing CSRF and foreign Origin | HTTP 403 |
| Real patient registration form | HTTP 201 |
| Search through the real UI after reload | HTTP 200, newly committed synthetic record visible |
| Administrator staff list and patient search | HTTP 200 and HTTP 403 respectively |
| Real dashboard Sign out button | HTTP 204, redirected to sign-in |
| Session lookup and old-cookie replay after logout | HTTP 401 |
| Independent Neon query for the deployed registration | One patient row and its `patient.created` audit event |

Three synthetic patient records were created across verification retries. Test credentials remained in ignored local files. The private harness needed selectors narrowed for duplicate registration/sign-out buttons, a non-empty search term for the role check, and a fresh CSRF token obtained through the real sign-out workflow. These harness failures were corrected; no application changes were required. The main private run recorded its first five passed groups in `.cache/neon-setup/deployed-results.json`; an isolated dashboard browser run subsequently passed UI logout and cookie replay. Full AUTH-06 expiry/throttling, other module journeys, backups, and performance were not rerun against Render.
