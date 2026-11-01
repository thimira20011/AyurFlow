# AUTH-06 identity and logging verification

Owner A; reviewer F. SRS IAM-01–05 and audit confidentiality, partial AT01/AT13. Started 28 October 2026 on `codex/auth-06-verification`, based on `dev` at `95c7d64`. AUTH-01–05 are implemented; AUTH-04 merged through PRs #30/#31. DEC02/07 and final reviewer acceptance remain open. Synthetic data only.

## Automated evidence map

These tests are executable checks, not a claim that the full browser acceptance scenario passed. Run from `backend`: `go test ./...`; then, against an isolated disposable database, set `TEST_DATABASE_URL` and run `go test -race -tags=integration -shuffle=on -count=1 -timeout=5m ./...` on a supported race toolchain. CI already runs both suites, checks for skipped integration tests and retains JSON results.

| Expected behavior | Test/evidence location |
| --- | --- |
| Argon2 verification and bounded password/hash inputs | `internal/auth/password_test.go` |
| Generic failed login, identifier throttling, session replacement/logout, disabled accounts, idle/absolute expiry | `TestSessionLifecycleIntegration` in `internal/auth/session_integration_test.go` |
| Expiry rechecked after database waits | `internal/auth/expiry_integration_test.go` |
| Secure/HttpOnly/SameSite host cookie, exact login Origin, logout CSRF | `internal/transport/http/auth_test.go` |
| Authentication error responses omit credential/internal-error canaries, prohibit caching and preserve cookies on failed operations | `TestAuthFailuresArePrivateAndUncacheable` |
| Panic recovery omits request body, cookie, CSRF, authorization header and panic-message canary from Gin output and HTTP response | `TestRecoveryDoesNotExposeRequestSecrets` |
| Direct API rejects missing/duplicate cookie, forged bearer/actor, cross-site reads, foreign Origin and missing/wrong CSRF | `TestRequireSession` in `internal/transport/http/protected_test.go` |
| Real patient access, role revocation, CSRF/session rejection and failed-audit rollback | `internal/transport/http/protected_integration_test.go` |
| Administrator alone denied clinical access; explicit assigned clinician allowed | `TestClinicalRouteBoundaryIntegration` |
| Staff writes enforce administrator/CSRF boundaries, revoke sessions and avoid lock-order deadlock | `TestAdministrationRouteBoundaryIntegration`, `TestDisableAndAuthenticationLockOrderIntegration` |
| Staff creation/role/disable audit rollback and competing-administrator safety | `internal/administration/service_integration_test.go` |

The recovery test checks the Go/Gin output sinks it controls. It does not prove reverse-proxy, hosting, browser-extension or external log-system redaction. Review those during OPS-01. Source-based abuse limits and production credential recovery remain DEC07 decisions, not features proved by identifier-throttling tests.

## Browser/direct API acceptance procedure — not yet executed

1. Record commit, date/tester, browser, HTTPS origin, OS, database version, and explicit timeout/throttle values. Follow [login setup](api/auth-04-login.md); use a trusted HTTPS certificate and retain Secure cookies. Use an isolated synthetic database, repository migrations and explicit synthetic bootstrap. Do not use real staff credentials or capture raw passwords/cookies/CSRF in evidence.
2. Create separately named synthetic accounts with only one role each: administrator, receptionist, clinician, therapist, dispensary and billing. Use the actual role catalog; do not grant every role to make a failing scenario pass. Obtain clinician/session assignments through the owning module's supported flow where implemented; record unavailable adapters/scenarios as pending.
3. In fresh browser contexts, verify anonymous direct navigation and direct protected API requests reveal no protected data. For each account, sign in, refresh, revisit a protected page and inspect role navigation. Verify administrator alone cannot read clinical records and non-administrators cannot list/change staff. Test the backend directly as well as hidden links. Module-specific record policies follow DEC02 and their implemented contracts.
4. Inspect cookie **attributes only**: `__Host-ayurflow_session`, Secure, HttpOnly, SameSite=Lax, Path=/, no Domain. Verify credential submission is POST, no password appears in URLs or browser storage, auth responses use `no-store`, and logout returns to sign-in. After logout, replaying the former cookie through the test harness must receive 401.
5. Submit a protected mutation with missing/wrong CSRF and with a foreign Origin, then a valid request using freshly obtained CSRF. Expected: rejected requests leave prior committed state intact; the valid request succeeds once. Rotate CSRF in another context sharing the session and verify stale-token rejection. Never automatically retry an uncertain mutation.
6. Exercise configured idle/absolute expiry and identifier lockout in the isolated environment. Record exact settings/timestamps and actual statuses; use short explicit test settings only for this test deployment. Do not treat test values as approved production defaults. Confirm UI handles expiry and backend rejects the expired cookie.
7. With a second administrator, change a synthetic account's roles and disable it while its browser session is active. Its next protected request must fail; disabled login must fail generically. Verify self-disable/self-demotion is blocked and audit events contain no password, hash, session/CSRF secret or clinical note body. Use authorized database inspection in the isolated test environment; no unrestricted audit HTTP route is assumed.
8. Exercise invalid credentials, service outage and failed logout: errors must remain generic, logout failure must not claim confirmed revocation, and the UI must not automatically repeat writes. Inspect controlled browser/API/proxy logs using synthetic canaries, recording only redacted evidence.

For each step, append expected/actual result, tester/date, version/environment, evidence link and defect ID if any. F must review the result. Leave failed or unexecuted scenarios open. Full AT01 is **pending** until this record exists; passing CI does not close it.

## Execution record

- 28 October 2026, Codex automation, Windows: `go test ./...`, `go vet ./...` and all-package integration compilation (`go test -tags=integration -run '^$' ./...`) passed. The new error-response and panic-recovery canary tests passed with expected generic status/body, no secret disclosure and no cookie mutation on failed authentication. No production behavior changed. PostgreSQL/Docker are unavailable locally; compilation is not database execution. Existing PostgreSQL results on prior feature branches remain historical evidence, not execution against this version. Branch CI evidence must be appended after the pushed workflow completes.
- Browser/HTTPS, current-version PostgreSQL/race execution and F review: pending. No pilot or real-data approval is claimed.
- Implementation commit `e827028` is pushed. Remote CI inspection was unavailable: the GitHub connector was unavailable and the local `gh` CLI was unauthenticated. Check the branch's workflow before merging; no new remote pass is claimed here.
