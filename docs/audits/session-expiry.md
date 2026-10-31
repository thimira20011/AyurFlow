# Session clock audit fix

**Task:** AUTH-02/AUTH-03 corrective audit; IAM-01–05 and partial AT01 support. Owner A; reviewer F. Branch `codex/audit-session-expiry`, based on AUTH-03 at `d592199`. The user approved this focused behavioral fix after the six-skill audit. This is not a structural refactor, a new timeout policy or clinic acceptance.

## Finding and change inventory

| Finding | Callers touched | Change and preserved behavior |
| --- | --- | --- |
| Session checks used time sampled before a database wait | `Authenticate`, `AuthenticateCSRF`, `Validate`, `Logout`; HTTP callers unchanged | Lock and fetch current session/account state, then sample the injected clock and reject idle/absolute expiry before any mutation. A shared private helper prevents these four paths from drifting. |
| Login checked throttling with pre-lock time and issued timestamps from before password work | `Login`; existing login handler/seed APIs unchanged | Resample time after acquiring the throttle row and after credential verification before persisting blocks or sessions. |

Cookie flags, CSRF comparison/rotation, role queries, failure envelopes, explicit operator session configuration and all exported APIs remain unchanged. PostgreSQL statements stay parameterized. Rejected expiry leaves prior idle time, CSRF hash and revocation state intact. No migration, new dependency, broad cleanup or performance claim is included.

## Verification evidence

Tester: Codex automation; local Windows/Go 1.27.3; synthetic fixtures only.

- Added `TestSessionExpiryAfterLockWaitIntegration`: hold a session row lock; start each operation; observe its actual lock wait using `pg_stat_activity`, the unique blocking backend PID and relation-specific SQL; advance a race-safe injected clock to the exact idle/absolute boundary; release the lock. Expected: all four operations return `ErrSession`, without idle refresh, CSRF rotation or logout revocation. Eight operation/boundary cases.
- Added `TestLoginClockAfterDatabaseWaitIntegration`: a blocked throttle row becomes eligible while waiting; successful login must use the fresh time. A query tracer advances the clock after credential retrieval, so new session timestamps must also reflect work after the initial throttle check. Empty role lists must remain non-nil for login and authentication.
- No arbitrary expiry sleeps: lock-state observation controls release; polling is bounded by a 15-second context and all workers are joined.
- Before applying the fix, the focused database tests compiled but skipped because no disposable `TEST_DATABASE_URL` was configured. Therefore local red-before-fix execution is **not claimed**. Linux CI must run these cases against PostgreSQL and with race detection.
- Local checks after the fix: focused auth/HTTP unit tests, vet, all-package build and tagged integration compilation passed. gopls semantic diagnostics were clean.
- Remote result: implementation `48dc075`, [workflow 40108342788](https://github.com/thimira20011/AyurFlow/actions/runs/40108342788), Ubuntu/Go 1.27.3/PostgreSQL 17.11. All four jobs passed. The [integration job](https://github.com/thimira20011/AyurFlow/actions/runs/40108342788/job/120914621823) ran 70 integration cases including subtests with race detection and no skips. All eight held-lock expiry cases and both Login clock cases passed, alongside existing authorization/audit/patient/billing regressions.

## Limits and handoff

The existing combined session/account locking clause is retained. AUTH-04 account disable/role administration still needs a consistent global lock-order review before its routes exist; this fix does not invent administration behavior. `Validate` still fetches roles after its rotation transaction, matching the pre-existing behavior; no all-path atomic snapshot guarantee is claimed. Token wire-length hardening, cleanup of throttle rows and measured search-query tuning remain separate audit findings. DEC07 and full AT01 remain pending.
