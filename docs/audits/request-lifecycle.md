# Request lifecycle audit repair

**Scope:** Member A shared API lifecycle; TASK-OPS-01 maintenance and IAM-01–05 availability support. Owner A, reviewer F. Branch `codex/audit-request-lifecycle`, based on AUTH-03 commit `d592199`. No session policy, business permission, applied migration or dependency changes.

## Confirmed issue and repair

The API's 15-second HTTP write timeout bounded socket writes, but did not give the request context a deadline. Queries, lock waits and verification-slot waits could continue after that response window. The router now installs a 10-second child context and propagates it through existing handlers/services/pgx calls. Parent cancellation and earlier deadlines remain effective. The five-second difference leaves response/error delivery time before the server's write timeout. Cancellation remains cooperative: a completed transaction is not undone merely because its response arrives late, and clients must still respect operation retry semantics.

`http.Server.Shutdown` leaves active connections open when its 10-second grace expires. Returning immediately could leave the deferred pool close waiting on blocked requests. The API now supplies requests with an independently cancelable server base context. Normal shutdown preserves active requests throughout grace. If graceful shutdown fails, it cancels request contexts and force-closes active connections before returning to pool cleanup. Both graceful and force-close errors remain observable. No mutation handler is moved into a background timeout goroutine.

## Verification (24 October 2026)

Codex automation on Windows/Go 1.27.3:

- `go test ./cmd/api ./internal/transport/http` passed.
- The focused deadline/shutdown cases passed ten consecutive runs. They cover a blocked handler receiving deadline cancellation, parent cancellation reaching the handler, the real router installing the deadline, an active request draining without premature cancellation, and a stalled request/client exiting after grace expiry.
- `go vet ./cmd/api ./internal/transport/http`, `go build ./...` and `go test -tags=integration -run '^$' ./...` passed. The tagged command compiles database cases; it does not execute PostgreSQL acceptance tests.
- Existing golangci-lint v2.15.0 configuration reported zero issues.

Remote result: implementation `ae15d90` plus audit report `81da1f9`, [workflow 40108125081](https://github.com/thimira20011/AyurFlow/actions/runs/40108125081), Ubuntu/Go 1.27.3/PostgreSQL 17.11. All four jobs passed. The backend job ran deadline/shutdown unit tests with race detection; the [integration job](https://github.com/thimira20011/AyurFlow/actions/runs/40108125081/job/120913970534) ran the existing 58 integration cases including subtests with race detection and no skips. gopls semantic diagnostics were clean.

No local PostgreSQL/race execution or performance benchmark is claimed; Linux CI supplies those regression/race checks. This does not close pilot deployment, DEC06 or AT acceptance. CPU-only work or a future handler that ignores its context cannot be forcibly interrupted by this middleware; downstream code must continue propagating and observing cancellation.
