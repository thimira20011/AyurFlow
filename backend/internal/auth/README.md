# Auth module

Proposed owner: A. Reviewer: F. SRS: IAM-01-05.

Staff accounts, Argon2id passwords, opaque sessions, expiry/revocation, throttling, CSRF and backend role/record checks.

Status: Argon2id hash/verify is implemented in `password.go` for TASK-AUTH-01. New hashes use a random 16-byte salt, 64 MiB memory, 3 passes and 4 threads; encoded parameters are checked and bounded before verification. The 64 MiB/3-pass/4-thread choice follows the second option in the [Go Argon2id documentation](https://pkg.go.dev/golang.org/x/crypto/argon2). A development-only `cmd/seedstaff` command creates explicit synthetic accounts after migrations.

TASK-AUTH-02 implements login, session lookup and logout under `/api/v1/auth/` when `AUTH_ENABLED=true`. DEC07 policy values remain pending, so auth routes are disabled unless every expiry, throttling and allowed-origin setting is supplied explicitly. Review these settings before deployment. Migration `000003_auth_login_attempts.up.sql` adds a PostgreSQL throttle ledger keyed by a hash of the normalized login identifier. Attempts serialize per identifier. DEC07 review must also assess source-level abuse and shared-terminal lockout behavior before activation. Unknown, disabled and wrong-password accounts receive the same login error; unknown accounts consume Argon2 work as well. Argon2 work is capped at four concurrent verifications per API process. A successful login revokes a previous session cookie within the same transaction.

Random session and CSRF tokens are stored only as SHA-256 hashes. Session lookup rotates the CSRF token, refreshes idle time and checks account status. Logout needs both the approved `Origin` and `X-CSRF-Token`. The cookie is Secure, HttpOnly, SameSite=Lax, Path=/ and has no Domain; the browser must use HTTPS. Account disable must call `RevokeStaffSessions` in its transaction. Validation already rejects disabled accounts.

AUTH-03 adds non-rotating `Authenticate`/`AuthenticateCSRF`, shared protected-route middleware, and transaction-scoped authorization in `internal/authorization`. Reception's patient registration/search/read/update routes are wired only with explicit auth configuration. Clinical/session access needs an owning-module assignment adapter; a missing adapter denies access. Administrator alone has no clinical permission. See [the authorization integration guide](../authorization/README.md) and [implemented review contract](../../../docs/api/auth-03-contract.md). AUTH-04 UI/account operations and full AT01 acceptance remain pending. OpenAPI retains reviewed endpoints pending DEC07/F contract review.

When adding those features, services own backend permission checks and transaction boundaries; handlers validate inputs; repositories use parameterized pgx queries. Update migrations, OpenAPI, frontend screens and relevant acceptance tests together. Never log passwords or hash strings.
