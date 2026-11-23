# Member C baseline — 12 November 2026

Scope: C contribution to TASK-SET-01/05; inventory of TASK-SCH-01–06 (SRS SCH-01–06, with CLN integration). C owns scheduling; B is the required peer reviewer. A coordinates setup/security. AT06/07 remain open.

## Setup and version

Tester: Codex on behalf of Member C. Environment: Windows PowerShell, synthetic-only repository; no patient database accessed. Base: `c6a44fa` on `dev`. Work branch: `codex/member-c-baseline`. No application behavior changed in this slice.

## Inspection results

Scheduling already has migration 000015, service and protected transport code, frontend screens, PostgreSQL tests and a [9 November implementation record](scheduling-inventory-workflows-2026-11-09.md). Current frontend documentation identifies raw booking ID entry as a usability gap. Historical test results are not a new test run, individual contribution attribution or B acceptance.

The central board's Pending scheduling rows require reconciliation with actual implementation and review evidence. No SCH task was marked Done during this baseline inspection.

## Local checks and actual outcomes

| Check / steps | Expected | Actual |
| --- | --- | --- |
| Inspect branch and working changes | Preserve pre-existing edits | Started on dev; only the earlier Member C checklist/task-board edits were present; created a separate baseline branch |
| `go version` | Repository pin: Go 1.27.3 | Installed Go 1.26.2 windows/386; required toolchain unavailable locally |
| `node --version`, `npm --version` | Node 22.23.2, npm 10.9.8 | Installed Node 24.14.1, npm 11.6.2 |
| `npm ci --no-audit --no-fund` in frontend | Install locked dependencies | Failed EBADENGINE; engine-strict correctly rejected mismatched toolchain; no bypass applied |
| `go test ./...` in backend | Run backend unit tests | Initial attempt failed creating default module cache; temporary cache retry reached toolchain download but sandbox DNS blocked proxy.golang.org. Elevated retry also failed: connection to proxy.golang.org:443 timed out. No unit tests executed |
| Check database test setup | Explicit disposable PostgreSQL configuration | TEST_DATABASE_URL unset; docker not found on PATH; no real PostgreSQL integrity proof obtained |
| `gh auth status` | Authenticated CLI for PR workflow | CLI not signed in; connected GitHub plugin separately confirmed repository push permission |

## Follow-up work, in order

1. Resolve the pinned Go/Node/npm toolchains with A. Preserve manifest pins; do not downgrade project requirements or disable engine checks to force a pass.
2. Install frontend dependencies with the matching versions; configure an explicitly disposable PostgreSQL instance and synthetic staff/session settings.
3. Run the shared checks and focused scheduling/clinical/HTTP PostgreSQL tests, then start the actual app and execute receptionist and assigned-therapist journeys.
4. Record expected/actual behavior and defects; select a task-sized scheduling fix with B. Add missing independent resource races/full-stack evidence where review confirms gaps.

Startup, AT06/07, and all SCH task acceptance remain incomplete. Before merging this PR into dev, all required CI tests must pass and peer review must complete.
