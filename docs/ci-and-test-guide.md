# CI and test instructions for incoming tasks

Member A maintains shared CI; each module owner writes its behavior tests and its reviewer checks the evidence. Passing CI is not AT01–AT17 acceptance or clinic approval.

## Required checks

| Job | Checks |
| --- | --- |
| `backend` | Parse/format all Go files, verify tidy module files, vet, all unit tests with race detection and shuffled order, static analysis, build every package/command. |
| `integration` | Start disposable PostgreSQL 17, migrate real schemas, execute all Go packages with the `integration` tag and race detector, reject skipped tests or an empty integration suite, retain JSON results. |
| `security` | Run a pinned `govulncheck` against reachable backend code. |
| `frontend` | Clean install from the committed lockfile, verify it remains unchanged, lint, TypeScript and production build. This does not claim browser/E2E coverage. |

The workflow runs on pushes and PRs. A syntax error, dependency mismatch, database failure or test failure must fail its job; fix the cause rather than removing the gate. Coverage/results artifacts are diagnostic evidence, not a coverage target or a claim that unimplemented workflows are tested.

## Add backend tests with each feature

1. Put ordinary tests in `backend/internal/<module>/*_test.go`. CI discovers them through `go test ./...`; do not add per-module paths to the workflow.
2. Put real database tests in `*_integration_test.go`, starting with `//go:build integration`. Name the top-level test `Test...Integration` so the results gate can identify executed integration cases.
3. Use `testutil.Postgres(t)` from `ayurflow/backend/internal/testutil`. It applies the real migrations and returns a pool confined to a generated isolated schema. Each independent case should create its own fixture; concurrent requests for the same business record must intentionally share one fixture.
4. Set `TEST_DATABASE_URL` to an explicitly disposable local database when running integration tests. CI supplies it automatically. Missing configuration fails in CI; local tests may skip with a clear message. Auth/audit/billing legacy variable names remain supported for local workflows.
5. Do not add always-skipped placeholders to a required suite. Tests for an unavailable external service belong to a separately configured suite. Do not use external clinic records, real credentials or production databases.
6. Exercise observable behavior: authorized success, forbidden direct access, failure preserving prior state, race outcomes, and retries where required. A test that merely recalculates the implementation's formula is insufficient.
7. Record the task/SRS IDs, setup, steps, expected/actual result, version, environment and evidence. Keep incomplete/failed AT cases open.

```go
//go:build integration

package yourmodule

import (
    "testing"
    "ayurflow/backend/internal/testutil"
)

func TestYourRequiredBehaviorIntegration(t *testing.T) {
    pool := testutil.Postgres(t)
    // Seed synthetic prerequisites, call the real service and assert its outcome.
    // Never create an alternate mock schema to bypass the real migrations.
    _ = pool
}
```

This snippet demonstrates fixture setup, not a completed behavior test. Before committing, replace the comment with real service calls and assertions. The helper migrates a shared extension baseline and an isolated schema; cleanup removes only that generated schema. An explicit disposable database with schema/migration privileges is required.

## Upcoming task coverage

| Tasks | Required behavior evidence when implemented |
| --- | --- |
| AUTH-03 | Direct unauthenticated/forbidden requests, CSRF rejection, role **and** record checks, administrator-only denial of clinical text. |
| AUTH-04/06 | Controlled account/role changes, disable revoking sessions, audit rollback and complete AT01 evidence. |
| PAT/CON/CLN | Identity uniqueness races, signing immutability, addenda/history, ordered transitions and hold/start races. |
| SCH | Room/therapist overlap conflicts, adjacent slots, atomic reschedule and assigned-therapist clearance. |
| INV/PRE | No preparation deduction, actual consumption rollback, insufficient stock, operation retries and traceability. |
| BILL | Changed receipt payload conflicts, identical/concurrent retry safety, overpayment/overflow rejection, audit rollback, patient reference/access and issued-history immutability. Current tests cover only the implemented subset. |
| OPS | Fresh migrations, repeat migrations retaining data, restart persistence, backup/isolated restore and deployment checks. CI schema tests alone do not prove operational recovery. |

Browser tests should accompany functional screens once their real backend paths exist. Add the browser test command/job in that feature PR and exercise the actual API; do not infer login or billing behavior from placeholder pages or a successful Next.js build.

## Local commands

### Frontend toolchain and lockfile recovery

Use Node **22.23.2** and npm **10.9.8**, matching the passing CI baseline. `.nvmrc` supports Node version managers; npm `engines` plus `frontend/.npmrc` reject incompatible install environments. `packageManager` records npm but does not install it automatically. CI explicitly installs and verifies npm before `npm ci`. Docker installs the same npm and copies `.npmrc` into its dependency stage.

With nvm-windows, run `nvm install 22.23.2` and `nvm use 22.23.2`; with POSIX nvm, run `nvm install` and `nvm use` from the repository root. Alternatively use your usual installer for that exact Node version. Then:

```powershell
node --version
npm install --global npm@10.9.8
npm --version
Set-Location frontend
npm ci
npm run lint
npm run typecheck
npm run build
```

For `EBADENGINE`, switch to the selected toolchain; do not disable strict checking or use `--force`. Missing lockfile entries (`EUSAGE`) require a dependency-graph repair. A Node/npm mismatch is a possible cause, not proof of how the file changed.

For a feature with no dependency changes, preserve local work, update from `dev`, and review the dependency-file diff. Restore `frontend/package.json` and `frontend/package-lock.json` from `origin/dev` only after confirming neither contains intentional changes. Run the clean install and checks above, then commit the repair.

For intentional dependency changes, run `npm install` using the pinned toolchain, review and commit both dependency files, and verify with `npm ci`. Keep `npm ci` in CI; it must not silently repair the graph. Do not hand-edit transitive entries. Local version settings can be overridden, so required CI and review remain necessary.

For a toolchain upgrade, update `.nvmrc`, package/lock engine metadata, `packageManager`, workflow npm version, Docker Node/npm versions and this guide together. Verify clean installation on Linux CI. `scripts/check.ps1` now clean-installs frontend dependencies before its checks.

From `backend`: `go test ./...`, `go vet ./...`, `go build ./...`; with a disposable `TEST_DATABASE_URL`, run `go test -tags=integration -shuffle=on -count=1 ./...`. On a supported C toolchain add `-race`; the Windows toolchain on the original verification machine cannot build 64-bit cgo, so Linux CI supplies that check.

From `frontend`: use `npm ci` before lint/typecheck/build to detect lockfile problems. Use the Node version pinned in the workflow. `scripts/check.ps1` runs local checks and database tests when `TEST_DATABASE_URL` is configured.
