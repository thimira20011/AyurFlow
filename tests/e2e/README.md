# Browser acceptance tests

Start identity checks with the [AUTH-06 browser/direct API procedure](../../docs/auth-06-verification.md). It maps automated tests and lists unexecuted browser steps; it is not a browser pass record.

The implemented frontend regression suite is [frontend/tests/browser/auth.spec.ts](../../frontend/tests/browser/auth.spec.ts). From `frontend/`, run `npm run build`, install Chromium with `npx playwright install chromium`, then `npm run test:browser`. It starts a production-build server on loopback port 3100 and intercepts `/api/v1` using synthetic responses. Cases cover anonymous routes, failed session lookup, real form submission, role denial, failed/successful logout, expiry and administrator-managed access guidance. It does not replace a configured HTTPS/browser/direct API journey with real PostgreSQL; backend session/permission behavior remains covered separately by Go integration tests and acceptance review.

Implement AT01-AT17 from the SRS as features become available. Use synthetic accounts and records. Verify the full patient-to-receipt journey, direct API permission failures, Unicode text, keyboard focus and 1366 x 768 / 1024 x 768 viewports. Record tester, date, setup, expected/actual result and evidence in `docs/testing.md`.
