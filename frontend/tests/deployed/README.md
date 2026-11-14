# AUTH-06 trusted deployment checks

Owner A; reviewer F or a recorded replacement. IAM-01–05, ADM-01 and AT01/AT13 support. This runner calls the deployed Next.js `/api/v1` proxy over trusted HTTPS using Playwright's real HTTP client. Certificate verification remains enabled. It does not replace browser acceptance, the isolated fullstack suite or independent review.

Use only the authorized synthetic deployment. Supply an existing synthetic administrator in a private, ignored JSON file with `administrator` (login identifier) and `password` fields. Never commit that file or use real staff credentials. From the repository root, after installing frontend dependencies:

```powershell
$env:AUTH_VERIFY_ORIGIN = 'https://ayurflow-frontend-l65w.onrender.com'
$env:AUTH_VERIFY_SYNTHETIC = 'yes'
$env:AUTH_VERIFY_CREDENTIALS = '.cache/private-synthetic-accounts.json'
$env:AUTH_VERIFY_IDLE_SECONDS = '300'
node frontend/tests/deployed/verify.mjs
```

The idle value must match the deployed configuration. This scenario targets the synthetic deployment's three-attempt limit and five-minute block, with a five-minute idle policy. It checks cooldown after the idle wait; if DEC07 changes those values, update the scenario before using it. Throttled, disabled and incorrect credentials must receive the same generic 401 response. There are no mutation retries.

Checks cover readiness and anonymous denial, administrator/reception boundaries, cookie attributes and no-store, missing/stale CSRF and foreign Origin, role-change/disable revocation, disabled login, logout replay, identifier throttling and actual idle expiry. Random run-specific billing accounts isolate lockout and role changes from existing users. Rejected account creation is followed by successful creation of the exact same identifier to prove it was not saved. The test never changes existing staff roles or disables the supplied administrator. Logging in replaces any session in that client; use a dedicated synthetic administrator.

The runner disables its created accounts and logs out the administrator in `finally`, retaining audit history. Inspect cleanup status after failure; if a write committed but its response was lost, use the run prefix in staff administration to find and disable the account before rerunning. Never delete history to clean up a test. A failed cleanup gives a nonzero exit code.

Only safe case names/statuses, timestamp, origin, configured idle duration and the synthetic run prefix are saved in ignored `.cache/auth-deployed/results.json`. No credentials, cookie values, CSRF tokens or raw HTTP responses are printed. Readiness status is printed to distinguish an unavailable deployment. Setup errors and failed checks exit nonzero. No traces or screenshots are generated.

Run the configuration guard regression through the existing frontend test command, or `node --test frontend/tests/deployed-verification.test.mjs` from the root. It does not contact a host.

Record the deployed version from Render's release record alongside results. An HTTP readiness response alone does not establish which commit is deployed. Absolute expiry with keepalive, actual browser behavior, module record-access cases, database audit contents and hosting/proxy log confidentiality still need their separate execution evidence. The runner explicitly lists these limits; a pass does not close AUTH-06 or approve DEC07/real-data use.
