# AUTH-06 deployed verification — 13 November 2026

Owner A; reviewer F or a named replacement, acceptance pending. Requirements IAM-01–05 and ADM-01; partial AT01/AT13. Tester: Codex-authored automation operated by Member A, against the authorized synthetic deployment. Runner source is based on `dev` commit `508e68ab0ef6ed0fda907b32bba2ec11d235162e`. The exact deployed Render revision has not been independently established; attach the Render release record before acceptance.

## Setup and procedure

Public origin: `https://ayurflow-frontend-l65w.onrender.com`, proxying `/api/v1` to the deployed Go service. Playwright HTTP client uses normal certificate verification, real responses and isolated cookie jars. No mocked API or direct database mutation. Existing private synthetic administrator credentials are read from an ignored file and never included here. New run-specific accounts start with billing-only access. Test configuration is the explicitly configured five-minute idle policy, three identifier failures and five-minute block; these remain synthetic settings, not final DEC07 approval.

Follow [the runner instructions](../../frontend/tests/deployed/README.md). The runner checks actual HTTPS response/cookie behavior and uses real administrator mutations to create, change and disable only its synthetic accounts. It waits longer than five minutes without refreshing the idle target. A correct-password attempt after that wait checks cooldown recovery. All writes are submitted once; uncertain writes are inspected rather than automatically retried. Cleanup disables created accounts and logs out the administrator, preserving audit history.

## Results

Final run completed at 13 November 2026 19:21:38 Asia/Colombo (13:51:38 UTC), exit code 0. Synthetic prefix `synthetic-auth06-93157d667788`. Expected and actual outcomes matched in all nine recorded groups:

| Check/steps | Expected and actual result |
| --- | --- |
| Trusted HTTPS readiness and anonymous requests | Readiness 200; anonymous session, patient and staff requests 401. Normal certificate verification succeeded. |
| Administrator session and boundaries | Login 200/no-store; host session cookie Secure, HttpOnly, SameSite=Lax, Path=/, no Domain; staff list 200 and valid patient search 403. |
| Missing/stale CSRF and foreign Origin | Each staff mutation 403; subsequent creation of that exact identifier 201, proving rejected writes did not reserve/create it. |
| Role-change and disable revocation | Billing staff administration 403; administrator changes target to reception; old session 401; new login and reception search 200; disable 204; existing session and disabled login 401 with generic invalid-credentials error. |
| Logout and replay | Logout 204; replayed original cookie 401. |
| Identifier throttling | Three wrong-password attempts 401; a correct-password attempt while blocked also generic 401. |
| Idle expiry | After an untouched interval of 303 seconds, session lookup 401. |
| Cooldown recovery | Correct-password login after the five-minute block 200. |
| Cleanup | All five created accounts disabled; administrator logged out; no cleanup error. |

The safe raw result remains in ignored `.cache/auth-deployed/results.json`; this table is its committed evidence summary. No secret/HTTP capture is committed. An earlier pre-cooldown runner also passed idle expiry and cleanup; only the final run above supports the complete table.

Initial diagnosis: the frontend readiness URL returned HTTP 502 while the backend readiness URL returned 200. A subsequent frontend check returned 200. No cause is asserted. A preliminary permission assertion used a patient-search request without the required query and received 422; the runner was corrected to use `q=Synthetic`, then received the expected administrator denial (403). These preliminary attempts are not recorded as passing acceptance runs.

## Verification and remaining gates

Local `npm test` passed all 14 tests, including the deployed-runner configuration guard. Focused ESLint and Node syntax checks passed. The guard requires explicit synthetic authorization, private credential file, HTTPS origin without credentials/path/query and a bounded integer idle duration; it contacts no host. CI runs this test through the existing frontend test command.

The original local checkout contains unrelated and prior work. Terminal Git fetching is blocked; only the named runner/test/documentation files are submitted through GitHub against the pinned current `dev` tree. Existing user changes remain untouched. Record the pushed branch's final CI results separately.

## Deployed database audit follow-up — 20 November 2026

At 16:44 Asia/Colombo (11:14 UTC), Codex automation inspected the five synthetic accounts from the 13 November run for Member A. The inspection used the existing read-only Neon backup role in an explicit read-only transaction over verified TLS. The evidence review was based on merged `dev` at `7d6f3334c77f339324d26616915df84c4d3390d3`.

Matched the five exact run identifiers to their staff records, then joined their staff audit events and actor references. Compared counts per account, checked the stored metadata keys and exact changed-field names, and counted sessions that were unrevoked and inside their absolute lifetime. The query returned only counts and boolean results.

| Expected | Actual |
| --- | --- |
| Five matched accounts, all disabled | 5 matched, 5 disabled |
| One creation and one disable per account, one role change for the managed account only | 5 creations, 5 disables, 1 role change. All per-account counts matched. |
| Staff events have an existing actor and timestamp, no reason payload or additional fields, and only the expected `roles` or `active` field name | All 11 events matched the metadata allowlist. |
| No unrevoked test session within its absolute lifetime | 0 |

The eleven inspected events satisfy the staff audit metadata check. This follow-up checked stored events for the original synthetic run. The Render dashboard could not be opened to verify hosting and proxy logs or identify the frontend and backend release revisions. Deployed absolute expiry despite keepalive, current deployed browser and module checks, final DEC07 policy, and independent reviewer acceptance also remain open. The isolated CI tests provide separate clock, audit and browser evidence.

## 26 November follow-up

The [deployed runner](../../frontend/tests/deployed/README.md) can now check the configured absolute lifetime while keeping the session active. It verifies a constant expiry timestamp through repeated refreshes, then sends the original token while still within the idle interval and requires HTTP 401. Local verification covered the runner's configuration guard. The initial Render frontend request returned 429. The later certificate-verified frontend requests returned 200 for readiness and 401 for an anonymous session. A dedicated synthetic administrator credential file was unavailable for this run, so the one-hour hosted test remains pending.
