# Member C scheduling recovery UI — 27 November 2026

Task: TASK-SCH-05; owner C, reviewer B pending. Contribution to F-owned TASK-UI-07 (F/A review remains open). SRS SCH-01–06 display/error behavior; AT06/07 support and partial AT15 keyboard/viewport evidence. Dependencies: existing protected scheduling endpoints, staff session provider and API client. Backend authorization/audit/clinical rules and DEC gates remain authoritative. No backend, schema or endpoint change; OpenAPI remains unchanged.

Branch `codex/member-c-scheduling-recovery-ui`, based on `dev` `a2e5be496fdecf9b7bb8f4f174f9d79e26f69a9e`. PR #104 remains independent and unmerged; its test changes are not a dependency.

## Design and implemented behavior

Reference: [Member C scheduling recovery draft page](https://www.figma.com/design/z0du8yEIF8zoZfemfhbIzo/?node-id=181-644), frames C-SCH-01–04. Figma plugin design context was retrieved for loading (`182:772`), empty (`182:796`), failure (`182:804`) and retry button (`182:809`). The new message/action region follows Lora 20/28, DM Sans 14/22 and caption 12/18, 32 px padding, 12 px spacing, forest/surface tokens and a 44 px primary action with the existing local paper texture. The existing staff shell and scheduling list/forms are reused; the older calendar/list and raw-ID form differences remain outside this slice. Existing Figma group designs were not edited.

A date is ready only after rooms, availability and sessions have all loaded for that date. Date changes synchronously invalidate the prior result, cancel outstanding reads and use a request generation guard so late responses cannot replace a newer date. Loading and failures hide old sessions/windows and disable all mutation forms. Input values remain in React state for retry. A successful empty result has its own state and moves keyboard focus to the date picker on request. Empty/null result arrays are handled.

Retry performs reads only. A confirmed write followed by failed refresh, or a lost write response, shows an honest unconfirmed-outcome warning and blocks further changes until a successful read. A 409 conflict requires fresh reads without claiming the failed mutation committed. No business write is automatically resubmitted. The date picker is locked during a mutation to keep its refresh bound to the submitted context. Invalid/cleared dates produce a recoverable message without network requests.

## Local setup and checks

Tester: Codex automation, 27 November 2026. Environment: Windows, Node 22.23.2 and npm 10.9.8 via cached `npm exec --offline --package=node@22.23.2 --package=npm@10.9.8`, Next.js 16.3.8, Chrome 158.0.8127.37. Locked dependencies installed with those versions; package/lockfile and engine gates unchanged. Next.js client-component/CSS guidance was read from the installed package before implementation. Generated `next-env.d.ts` changes were restored after checks.

- [x] ESLint passed with zero warnings on final source.
- [x] Type check and production build passed.
- [x] All 23 unit tests passed.
- [x] All 53 browser regressions passed, including seven new scheduling cases (24.5 s full-suite run).
- [x] Visually review recovery screenshots at 1366×768 and 1024×768; no horizontal overflow or state-card wrapping defects. Existing page scrolling/form layout remains.
- [ ] B/F independent review and complete AT15 acceptance.

The first browser fixture incorrectly delayed room requests and then used a label selector that included native select option text. Those test-harness issues were corrected (explicit delay predicate and accessible combobox roles); the final run passed. The first published frontend run also exposed that the local checkout lacked newer shared frontend work. The final source was reapplied on the current dev scheduling file, preserving shared Field/Notice/StatusBadge use, inline time errors and focus handling; current dev frontend files and fixtures were synchronized for the 23-unit/53-browser verification. The existing loading-state regression assertions were updated only for the intentionally changed messages. No failed run was counted as success.

## Reproduction and expected/actual outcomes

From `frontend`, run `npm run lint`, `npm test`, `npm run typecheck`, `npm run build`, then `npm run test:browser`. For the focused cases use `npm run test:browser -- scheduling-recovery.spec.ts`. Locally `AYURFLOW_BROWSER_CHANNEL=chrome` selects the installed browser; CI uses its installed Chromium. The browser fixtures intercept API responses with synthetic records, while rendering the real app. They are not real Go/PostgreSQL acceptance evidence.

| Case | Expected and actual |
| --- | --- |
| Loading/failure/retry at 1366 and 1024 | Old session/windows disappear; mutation controls disable; failure is not shown as an empty day; entered IDs/resource/time survive; keyboard Enter retries reads and restores controls. Programmatic submit while disabled emits zero writes. PASS for both widths. |
| Rejected 409 booking | Controls block until fresh read; no ambiguous-success claim; entered patient retained; exactly one rejected write and no booking auto-retry. PASS. |
| Slow prior date | Delay both date-specific reads, select a later date, then release old replies. Later date remains displayed. PASS. |
| Empty and cleared date | Null lists become valid empty state; choose-date action focuses picker; clearing date emits no reads or stale content and can recover. PASS. |
| Write saved, refresh failed | Show uncertain outcome and block mutation controls; explicit retry loads the saved booking using reads only, total writes one. PASS. |
| Write response lost | Same read-only recovery without falsely claiming no booking was submitted; total writes one. PASS. |

Screenshots are generated under `frontend/test-results/scheduling-recovery-*/schedule-recovery-1366.png` and `schedule-recovery-1024.png` (ignored local outputs). The existing 1536×1024 `/brand/paper.png` is nonempty and matches the documented Figma asset SHA-256 `9d964d285e64f90a220ed249174d17594147a75f72e5e126804eff229660277c`; no temporary Figma asset URLs are runtime dependencies. The retry texture uses that asset in the new action's soft-light layer; original shell artwork remains in its existing callsites.

The associated PR execution section attaches the published commit, required CI outcomes and job links. All required checks must pass on that commit before merge. Full synthetic Go/PostgreSQL scheduling journey, final SRS review, clinic approval, real-data authorization and pilot readiness are not established here. Parent tasks remain In progress/review.
