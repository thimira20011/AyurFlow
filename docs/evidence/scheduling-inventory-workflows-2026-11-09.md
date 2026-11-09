# Scheduling and inventory implementation check — 9 November 2026

Branch: `member-b/scheduling-inventory-workspace-ui`. Scope: scheduling (`SCH-01`–`06`, C with B review) and inventory/preparation (`INV-01`–`08`, D with E review). Tested with synthetic records only. The branch includes the previously closed, unmerged inventory batch work from PR #74 and the merged `dev` changes from PR #67.

## Local checks

| Check | Environment and setup | Actual outcome |
| --- | --- | --- |
| `go test -count=1 -tags integration ./...` | Go 1.27.3; disposable PostgreSQL 17.11 container on `127.0.0.1:55433`, fresh isolated fixtures and all forward migrations | Passed all packages, including scheduling and inventory preparation integration suites, runtime grants and protected HTTP routes. |
| `go test -count=1 -tags integration ./internal/scheduling ./internal/inventory ./internal/clinical ./internal/transport/http` | Same PostgreSQL container, after the guarded availability edit | Passed all affected packages. |
| `npm run typecheck` and `npm run lint` | Frontend installed dependencies, Node 22 | Both passed. |
| `npx next build --webpack` | Frontend production build on Windows | Passed compilation, TypeScript, static route generation and standalone output. |
| `npm run test:browser -- --grep 'reception schedule\|dispensary uses live'` | Edge/Playwright, production Next server, mocked synthetic `/api/v1` responses | 2 passed. Checked receptionist booking controls at 1024px and live dispensary recipes/traceability without preview content. |

The PostgreSQL suites verify overlap races, availability edits that preserve booked coverage, reschedule rollback, clinical clearance/hold/cancel integration, immutable snapshots, no stock deduction at save, consumption rollback, retry idempotency, stock race and traceability access. These are implementation checks. They do not replace `AT06`–`AT11` execution records with reviewer, version, expected/actual results and clinic DEC03 sign-off. A richer patient/plan picker remains follow-up work.

## PR #77 auth-browser regression

The GitHub `auth-browser` job exposed that an approved preparatory stage with no delivered session could advance. The clinical review record leaves empty-stage completion undecided, so the scheduling completion adapter now returns `ErrCompletionPending` until at least one session is completed and none remain booked or in progress. A PostgreSQL integration test checks the empty, booked and completed cases. After the change, `go test -count=1 -tags integration ./internal/scheduling ./internal/clinical` passed locally against disposable PostgreSQL 17.11. The PR's HTTPS fullstack check must confirm the browser regression is resolved.
