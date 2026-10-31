# AUTH-04 login slice — 26 October 2026

Owner A, reviewer F; IAM-01–05, partial AT01. Based on `dev` at `598c625`. Existing login pages were disabled placeholders; no working login/account implementation was found on the relevant auth/F branches. B's open patient-screen PR independently bootstraps session CSRF; no patient feature files are overwritten.

The sign-in form now posts credentials to the existing same-origin `/api/v1/auth/login`. Passwords and raw session cookies are never placed in URLs, logs or browser storage. The HTTP-only cookie remains server-managed. Session/CSRF data is held in React memory; startup/focus checks call `/auth/session`, and authenticated responses/absolute expiry update the visible state. No periodic keepalive silently extends idle sessions. API 401 responses clear client state; service failures display retry guidance. The browser guard/navigation is convenience only; Go still authorizes every protected operation.

Successful sign-in opens `/workspace`, which lists explicit role work areas. Administrator alone gets no clinical or patient link. The existing synthetic dashboard remains a separately accessible authenticated demo; its mock content is not a live clinical data source or permission proof. Shared role-based UI visibility does not grant record permission to a clinician/therapist without a backend assignment adapter.

Logout obtains fresh CSRF immediately before calling the existing endpoint. A 204 confirms revocation; an expired/invalid session also clears the UI. Failed logout retains the warning that a session may still be active. Wrong/stale CSRF now returns 403 `csrf_failed` without clearing the cookie; it no longer disguises a failed revocation as a successful logout. Mutations are never automatically retried after ambiguous network failure. Other tabs or B's bootstrap can rotate CSRF; on rejection, refresh/retry deliberately. Feature owners should use `apiMutation` rather than keeping a long-lived CSRF snapshot.

No public signup is added; `/sign-up` explains administrator-controlled staff access. Misleading remember-me/recovery placeholders are removed. DEC07 timeouts/throttling stay explicitly configured; recovery/forced password changes remain pending. UI error summaries are focused/announced, inputs retain labels/password-manager autocomplete and paste support, and forms use POST even before hydration so credentials cannot fall back to a GET URL.

## Development setup

Apply migrations and create synthetic staff using the existing seed instructions. Supply every `AUTH_*` value from `backend/.env.example` explicitly in the Go process environment. The API requires an exact HTTPS frontend origin. Use the existing HTTPS proxy template or Next's documented development HTTPS option (`npm run dev -- --experimental-https`) with a locally trusted development certificate; set `AUTH_ALLOWED_ORIGIN` to that exact origin. Keep frontend `BACKEND_URL` pointed to the backend. Compose still leaves auth disabled by default; this slice does not declare OPS-01 deployed. Never weaken Secure cookies for HTTP testing.

## Verification

The shared API-client tests run with Node's built-in test runner and the already-pinned Node 22.23.2; no dependency is added. Cases check credential POST/cookie transport, fresh CSRF and 204 handling, safe errors, relative URLs with Unicode queries, no automatic write retry and administrator clinical denial in navigation. CI and `scripts/check.ps1` run `npm test` alongside lint/typecheck/build. Go HTTP/session tests cover the logout CSRF status/cookie behavior; existing PostgreSQL/race CI covers real session state. Browser/UAT evidence and F review remain separate from helper/build checks.
