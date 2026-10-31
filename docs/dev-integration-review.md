# Dev integration review — 23 October 2026

Reviewed `dev` at `a9eeb93` after PRs #14 (billing), #15 (frontend authentication layout) and #13 (shared audit). This is a targeted merge/CI review, not full project acceptance. User authorized repairs to confirmed implementation defects. Repair branch: `codex/dev-ci-integration-fixes`, owned by A with F review; billing behavior also needs E/D review.

## Confirmed CI blockers

- `backend/internal/billing/doc.go` contained two `package billing` declarations. The second declaration at line 28 caused a parser/build failure. Reproduced with `go test ./...` on an isolated copy of `dev`. Billing files also needed gofmt. The [first failing billing merge workflow](https://github.com/thimira20011/AyurFlow/actions/runs/39825393675) failed before unit/database tests.
- `frontend/package-lock.json` lost required optional/transitive dependency entries while `package.json` remained unchanged. [The latest failing dev workflow](https://github.com/thimira20011/AyurFlow/actions/runs/39837824830) rejected `npm ci` with missing `@emnapi/core`, `@emnapi/runtime` and incompatible `@emnapi/wasi-threads`. Restoring the last passing lockfile from `812a93f` repairs the dependency graph without changing declared dependency versions.

These are genuine source/dependency problems caught by CI. The auth/audit integration tests were skipped downstream of the parser failure; they were not the source of those failures.

## Confirmed behavior repairs

- Receipt retry lookup returned any existing operation ID without comparing invoice, amount, method or label. The repair conflicts on changed material input and returns the original receipt only for matching input.
- The old lookup happened before invoice locking and was not repeated after acquiring the lock. Concurrent identical requests could fail with an overpayment conflict or unique-key error. A transaction advisory lock on the canonical operation UUID now precedes receipt lookup and invoice locking, including cross-invoice attempts.
- `paid + amount` could overflow int64 and bypass the overpayment guard. Compare the amount against `total - paid` after validating the committed balance. Validate line multiplication and PostgreSQL quantity bounds before inserting items.
- Billing now calls the shared transactional audit writer instead of maintaining a separate raw INSERT implementation.

PostgreSQL regression tests exercise the actual invoice create/add/issue and receipt services, changed payloads, canonical UUID retries, concurrent identical/conflicting/competing payments, integer overflow, and forced audit failure rollback. They do not claim permission or patient-FK coverage that is still gated.

## CI improvements and remaining gates

The initial vulnerability scan found reachable advisories in Go 1.27.1, `x/net`, `x/text` and `quic-go`. Upgrade the build/CI/module toolchain to Go 1.27.3 and update affected existing dependencies and their required module graph. The repeated local `govulncheck` reports zero reachable vulnerabilities (one additional required-module advisory has no called path).

CI discovers every Go package, runs all tagged database tests in isolated synthetic schemas, fails on skipped required cases, and retains coverage/JSON artifacts. Fresh/repeat migration and fixture-isolation tests cover the shared infrastructure. See [ci-and-test-guide.md](ci-and-test-guide.md).

Both `000004_audit_integrity.up.sql` and `000004_billing.up.sql` are already merged. The runner records full filenames, so this duplicated numeric prefix does not itself explain today's CI failure. Preserve existing filenames because another developer may already have applied them. Coordinate the next migration number from the latest `dev`; this repair does not rename or edit an applied migration.

Billing routes remain unregistered under AUTH-03. Patient references await PAT-01, DEC04 remains pending, and full AT12/AT13 remain open. The authentication pages remain placeholders with disabled submission; no working signup or login flow is claimed by their build.

Local repair checks: clean npm install, frontend lint/typecheck/build, Go unit tests, vet, builds, static analysis, vulnerability scanning and integration-test compilation passed. [The repair workflow](https://github.com/thimira20011/AyurFlow/actions/runs/39843220759) passed all four jobs, including PostgreSQL/race execution with 28 integration cases and no skipped tests. Detailed evidence and remaining acceptance limits are recorded in [testing.md](testing.md).
