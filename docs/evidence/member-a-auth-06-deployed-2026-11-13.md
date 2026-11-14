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

Still pending: deployed absolute expiry despite keepalive; browser/UI checks on the current deployed revision; module-specific record/report restrictions; actual database audit and hosting/proxy log confidentiality inspection; independently recorded deployed release version; final DEC07 policy and F/named replacement review. Existing isolated CI tests provide separate clock, audit and browser evidence. This deployed API slice does not close AUTH-06/AT01/AT13 or authorize real-data use.
