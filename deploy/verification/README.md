# Clean startup and persistence verification

TASK-OPS-04; owner Member A, reviewer Member F (or a named team-approved replacement). SRS OPS-03, NFR-04 and NFR-06; AT17. Prerequisites: current module migrations, the synthetic staff seed, the pilot images and reviewed runtime grants. This provides repeatable delivery evidence for the implemented slice. Full AT17 also requires reviewed API/guides, a named member's walkthrough and recorded handover responsibilities.

## Run in an isolated Docker environment

Install Node 22.23.2 and Docker Engine/Desktop with Compose 2.24.4 or later. Internet access is needed to build the existing Go/Next.js images. Run from a clean checkout of the branch under review, with loopback port 3444 free:

```powershell
node deploy/verification/smoke.mjs
```

The same command runs in `.github/workflows/clean-start.yml`. No database URL, Neon login, Render access or existing staff credential is required. It does not load the application's `.env` files. It creates a random `ayurflow-ops04-*` Compose project, new PostgreSQL and certificate volumes, and random synthetic credentials under ignored `.cache/ops-04/`. Only `127.0.0.1:3444` is published; database, API and frontend ports stay private.

The fixture merges `compose.yaml` in this directory with the actual `deploy/compose.pilot.yaml`. Its differences are an isolated PostgreSQL 17.11 database, loopback HTTPS and explicit test-only auth settings. PostgreSQL traffic stays inside the disposable Docker network; HTTPS verifies Caddy's local CA. These settings do not select DEC07 production policy or prove a public certificate/firewall. The deployed Render/Neon services are untouched.

## Expected checks

1. Build the existing migration/API/frontend images and verify port and secret isolation.
2. Prove the database is empty, create separate restricted migration/application roles and apply every embedded migration. Repeat migrations and compare the complete ledger, including original timestamps.
3. Apply the real runtime-grant script. Seed a synthetic receptionist, repeat with another password/role, then verify the original account, password and role remain. Check the runtime role cannot create schema objects, read migration history or update audit history.
4. Serve the production frontend over HTTPS. Reject anonymous patient requests; log in and create a Unicode synthetic patient through the protected API. Independently check its committed audit event.
5. Stop and remove all four service containers while preserving volumes. Recreate PostgreSQL, repeat migrations, then recreate API/frontend/proxy. Check all container IDs changed, the migration ledger and patient/audit data are identical, original credentials still work and API search returns the same patient/code.
6. Check runtime service logs for generated passwords and session secrets. Remove only the randomly named test project's containers and volumes, and delete its credential files.

Successful execution prints seven `PASS:` lines. `.cache/ops-04/results.json` records commit, UTC time, environment, outcomes and cleanup status. CI uploads only this redacted result. The per-project `private.log` may contain SQL output and password hashes; keep it local and never upload it. Failed steps produce a non-zero exit and remain failed evidence.

If execution is interrupted, check the private log's project directory name. Use that exact `ayurflow-ops04-*` project name for manual cleanup; never remove the shared pilot's volumes. Reruns always use a new project. The harness removes its disposable volumes after normal success or failure, so this is an automated persistence proof rather than an environment to keep using.

## Acceptance record

Record the run URL, commit, tester/date, Docker/toolchain versions, expected/actual checks, failed steps and reviewer in `docs/testing.md`. The project-wide task remains open until independent walkthrough, reviewed OpenAPI/guides and named handover responsibilities are complete. This startup test does not cover the complete clinical-to-receipt journey or substitute for the isolated backup recovery in AT16.

Compose behavior follows the official [merge/override reference](https://docs.docker.com/reference/compose-file/merge/) and [environment passing instructions](https://docs.docker.com/compose/how-tos/environment-variables/set-environment-variables/).
