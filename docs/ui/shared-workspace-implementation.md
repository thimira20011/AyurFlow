# Shared staff workspace implementation

Member B implementation branch `member-b/shared-workspace-ui` covers the frontend slice of TASK-UI-01 and TASK-UI-06. F remains the accountable UI owner and A the reviewer. The relevant SRS behavior is role-scoped staff navigation and usable protected screens; AT15 is the viewport/keyboard acceptance check.

The shared Living Heritage shell now provides the paper canvas, forest sidebar, header, Asia/Colombo date, role identity, navigation and sign-out for the workspace, patient/clinical screens, scheduling and inventory placeholders, billing preview, and clinician assignments. The existing reception and staff-account pages retain their feature forms while using the same forest/paper palette and header treatment. The generic dashboard redirects to `/workspace` so it cannot show separate synthetic appointment figures.

`/workspace` shows only areas named by the current server session's roles. No navigation link grants record access: protected API requests still require backend role and record authorization. Scheduling and inventory remain labelled unfinished screens; reception and billing remain labelled synthetic previews. A failed sign-out remains visible as an error, and expired or denied sessions remove protected content.

The shared surface styles cover the role landing, placeholders and clinician-assignment controls; existing patient, consultation and staff tables retain their tested feature components. This slice does not implement the scheduling, inventory or billing business journeys.

Verification on 7 November 2026: `npm run typecheck`, `npm run lint`, `npm run build` passed; `AYURFLOW_BROWSER_CHANNEL=msedge npm run test:browser -- --reporter=list` passed 20 synthetic browser tests, including role navigation, logout, staff management and 1366×768/1024×768 focus/layout checks. The bundled Playwright Chromium was absent locally, so Edge was used. These are UI regression checks, not full AT15 or real backend acceptance.
