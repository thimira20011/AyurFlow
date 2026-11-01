# OPS-01 pilot configuration

Owner A, reviewer F. SRS IAM-01–05, AUD-01–02, deployment support for AT01/AT17. This is a synthetic-only deployment candidate; DEC05/06/07, live HTTPS/browser evidence and F acceptance remain open. It does not configure backups or claim pilot readiness.

`compose.pilot.yaml` is standalone. **Do not combine it with the root development Compose file**, which publishes local database/API/UI ports and uses owner credentials. Pilot exposes only Caddy on TCP 80/443; backend/frontend share a private Docker bridge. PostgreSQL is operator-provided, reachable only from the approved host/network through its firewall. Use a dedicated database, PostgreSQL TLS with `sslmode=verify-full` and a trusted CA; mount the CA read-only at the path specified by `sslrootcert` if the provider does not use a system-trusted CA. Never disable verification for a remote database.

## Provision the database

Have the DBA create distinct login roles `ayurflow_migrator` and `ayurflow_app`, both `NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`, with no membership in each other or a privileged role. Set separate passwords interactively with psql `\password`; do not put passwords in shell command arguments or SQL files. The migrator owns the dedicated application schema/tables; the application must never own them. Install `btree_gist` as DBA if needed. Give the migrator USAGE/CREATE on the chosen schema and CONNECT on the database. Configure both DSNs' search path consistently; `public` is the supplied example.

As DBA, remove PUBLIC CREATE/TEMPORARY/CONNECT on this **dedicated** database, grant CONNECT only to the two roles, and remove PUBLIC CREATE on `public`. Do not run these changes against a database shared by other applications. The runtime role receives schema USAGE, specific existing-table DML and append-only audit rights from `runtime-grants.sql`, never migration-table or future-table grants. Keep application/migration roles free of inherited privileges. The SQL script is an operator grant step, not an applied module migration.

After migrations, run as the migration owner with psql's password prompt or an externally protected `PGPASSFILE`:

```sh
psql -X -v ON_ERROR_STOP=1 -v app_role=ayurflow_app -v schema=public -f deploy/runtime-grants.sql
```

Provide the non-secret connection host/database/user through libpq configuration. Do not pass a credential-bearing URI on the command line. Rerun grants after each reviewed migration before restarting the API. New tables require an explicit grant-script review; no default grant silently exposes them. Database privileges isolate schema/history administration; backend role/record checks still enforce each staff member's permissions. Existing immutable clinical/billing triggers remain in force.

## Configure and start

1. Select the DEC06 host, DNS name, database/firewall and persistent storage. Route DNS to the host; allow inbound 80/443 for Caddy certificate issuance/HTTPS. Restrict SSH to operators. Preserve Caddy `/data` and `/config` volumes across restarts. Choose a reviewed Caddy image pinned by version and digest in `CADDY_IMAGE`.
2. Copy `deploy/.env.example` to an operator settings file **outside the repository**. Fill the hostname (no scheme/path), image and every explicit AUTH setting; no production defaults are selected. Protect two separate secret files outside Git, each containing exactly its role's database DSN. Set their absolute paths in the settings file. Use OS permissions to limit access to the deploy operator while allowing the container's non-root `app` user to read its bind-mounted secret. Ordinary Compose file secrets are host files, not an encrypted vault; host/Docker administrators can read them. Never share rendered secret contents.
3. Validate config, build, run migrations, apply grants, then start the application. Example on the chosen Linux container host:

```sh
docker compose --env-file /secure/ayurflow/pilot.env -f deploy/compose.pilot.yaml config --quiet
docker compose --env-file /secure/ayurflow/pilot.env -f deploy/compose.pilot.yaml build
docker compose --env-file /secure/ayurflow/pilot.env -f deploy/compose.pilot.yaml run --rm migrate
# Apply runtime-grants.sql as described above. Do not start API on failure.
docker compose --env-file /secure/ayurflow/pilot.env -f deploy/compose.pilot.yaml up -d backend frontend proxy
```

The maintenance-profile migration service runs explicitly and is not started by normal `up`. Only it receives the migration DSN. The API reads `DATABASE_URL_FILE`; direct `DATABASE_URL` remains supported for development, but setting both fails. DSN file errors are generic and never include file contents. No database secrets go into image builds or the frontend. Stop the application before schema/grant changes; deploy during an approved maintenance window with a verified backup. Do not use this candidate for real data before backup/restore and release gates pass.

Initial synthetic account creation uses the existing development-only seed on an isolated development database; there is no production bootstrap/recovery workflow. Do not disable the seed guard or rebrand synthetic bootstrap as production provisioning. Agree the production initial-admin/recovery procedure under DEC07 before real-data deployment.

## Verify and record

Check `https://<host>/api/v1/health` and `/ready`, certificate validity, HTTP-to-HTTPS redirect and absence of public 3000/8080/5432. Follow [AUTH-06](../docs/auth-06-verification.md): login → reception registration → search, forbidden direct requests, CSRF, logout, disable and expiry. Record version, operator, host configuration (redacted), steps, expected/actual results and F review. Inspect proxy/host logs for secret/note disclosure; the Caddy template does not enable access logging. Restart containers and verify committed synthetic records persist in the external database. An isolated restore remains OPS-02, not a consequence of restart success.

On failure, stop/restrict traffic and retain committed data. Inspect service status and redacted logs; do not automatically reverse applied migrations or delete volumes. Roll forward with a reviewed fix or use the separately tested recovery procedure once available.

## Evidence

28 October 2026, Codex automation, Windows: Go unit tests, vet and all-package integration compilation passed. The PostgreSQL integration test applies the actual grant script in an isolated schema with a distinct unprivileged role and checks allowed DML/reads and denied DDL/history modification. CI also renders pilot Compose and validates Caddy syntax. Docker/PostgreSQL execution is unavailable locally; remote execution outcomes are recorded after checks. Live deployment, DNS/certificates, firewall, runtime secret permissions and F acceptance remain pending.

**Remote result:** implementation `0b536cf` passed all five jobs in [workflow 40639877368](https://github.com/thimira20011/AyurFlow/actions/runs/40639877368): deployment, backend, integration, security and frontend. Linux CI rendered Compose with the maintenance profile enabled, passed the exposure/secret assertions, validated Caddy configuration and executed PostgreSQL integration tests with race detection and skipped-test rejection. The first run's deployment check omitted the maintenance profile and failed; that CI invocation was corrected. This is configuration/database regression evidence, not a live HTTPS deployment or AT01/AT17 acceptance.

References: [Compose file secrets](https://docs.docker.com/compose/how-tos/use-secrets/), [Caddy reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy), [PostgreSQL privileges](https://www.postgresql.org/docs/17/ddl-priv.html). Operators must review settings for the selected platform.
