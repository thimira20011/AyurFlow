# AUTH-06 real browser/API verification

Owner A; reviewer F. IAM-01–05, ADM-01 and audit confidentiality; AT01/AT13 evidence support. This suite uses the actual production-built Next.js frontend, its `/api/v1` rewrite, the compiled Go API and migrated PostgreSQL. It does not intercept API responses.

## Run against a disposable database

Requires the repository-pinned Node/npm and Go versions, PostgreSQL client `psql`, OpenSSL and Chromium. Create an **empty**, local-only database named `ayurflow_auth_e2e` with extension/migration privileges. Set `AUTH_E2E_DATABASE_URL` in the process environment to its PostgreSQL connection URI. The harness rejects a remote host, another database name or any existing user tables. It never drops a database or resets existing records. Recreate the disposable database yourself before another run. Never use a real-data database.

From `frontend/`:

```sh
npm ci
BACKEND_URL=http://127.0.0.1:8080 npm run build
npx playwright install --with-deps chromium
npm run test:fullstack
```

On PowerShell, set `$env:BACKEND_URL = 'http://127.0.0.1:8080'` before the build instead of the shell prefix. CI's `auth-browser` job supplies a fresh PostgreSQL 17.11 service and runs this procedure. Ports 8080, 3100 and 3443 must be free; no existing server is reused.

`start.mjs` builds the existing API/migrate/seed commands, applies all real migrations and seeds one synthetic account per role with a random run-specific password. Repeating the administrator seed with a different password/role must preserve the original account, as verified by its browser login and role checks. The harness starts loopback Go/Next processes and a test-only Node HTTPS proxy. No production application configuration, endpoint or migration changes. The Next process does not receive the database URL or fixture password.

Explicit **test-only** policy: idle 20 seconds, absolute 60 seconds, three identifier failures in 30 seconds, five-second block. Neither these values nor the self-signed certificate settle DEC07 or OPS-01. Playwright accepts this isolated certificate; the run proves HTTPS cookie transport, **not** a trusted deployment certificate, host firewall or production proxy. Secure/HttpOnly/SameSite/host-only cookie requirements stay enabled.

## Checks and evidence

Fifteen cases cover anonymous browser/direct API denial; all seven single-role browser logins, refresh and logout with old-cookie replay; cookie flags, no credential URL/browser storage and no-store responses; wrong Origin and missing/stale CSRF with unchanged staff state; actual account creation/role/disable UI and backend revocation/self-lockout; assigned clinician access and grant/revoke with administrator/reception denial; real-time identifier cooldown, idle expiry and absolute expiry despite keepalive; and real critical audit events. Each case independently checks controlled process output/audit for its password, cookie, CSRF and note canaries, including after a failed case. Idle checks leave a gap longer than the idle limit rather than refreshing continuously. Absolute expiry compares instants at JavaScript's millisecond precision because PostgreSQL stores microseconds while Go can serialize nanoseconds. Unimplemented therapist/session and report/export record policies remain outside this run.

`member-b.spec.ts` adds real backend/browser cases for the B-owned AT02–03 journeys and CLN-05 screen: receptionist registration, Unicode search, demographic correction and phone-absent postal confirmation; assigned clinician draft/edit/sign/addendum and direct denial to non-clinical roles; plan creation, start, guarded approval, reasoned hold/resume and fail-closed advancement/cancellation. It checks 1366×768 and 1024×768 layout width. These cases use the same disposable synthetic database, HTTPS proxy and no-interception policy. C review, signed DEC02 evidence and the C/D completion adapters remain separate acceptance gates.

`.cache/auth-e2e/` is ignored and private. Fixture credentials, certificate key and service output are never uploaded. Traces, video and automatic screenshots are disabled because they can capture passwords, cookies and CSRF headers. Only `results.json` (case names, statuses and safe assertion diagnostics) is retained as a CI artifact; assertions never print raw cookies, credentials, audit rows or note canaries. CI removes fixture credentials and TLS files even after failure. Local users must remove those private files after inspection. Do not publish raw Playwright network traces or service logs.

Record run URL, commit, date/tester, environment, case outcomes and defects in `docs/auth-06-verification.md`/`docs/testing.md`. A green run supports current-version automated evidence; F review, approved DEC07 policy, deployed/trusted HTTPS and the remaining module scenarios still gate full AT01/AT13 acceptance.
