# Member F report-navigation verification

Date: 10 November 2026 (Asia/Colombo). Task: TASK-QA-02 navigation slice, TASK-UI-01 support; SRS REP-01, AT13 support. Owner F; reviewer A, existing E-owned billing service contract used as the permission baseline; no human review/approval claimed. Branch: member-f/task-qa-02-report-navigation; base dev f503c7b fetched before branching.

Before: shared /billing guard excluded report_reader although billing screen and backend outstanding service supported it. After: report_reader can navigate from its workspace to the report, reload it, and keep a report sidebar even when combined with clinician. Invoice mutation controls remain unavailable. Administrator alone remains denied.

Environment: Windows, installed Node 24.11.1, Next 16.3.8 production build, Playwright with Edge; synthetic browser API interception. This is frontend regression evidence, not a live Go/PostgreSQL run or full AT13 acceptance.

Checks: npm test passed all 16 cases; npm run lint and npm run typecheck passed; npm run build passed. Browser suite: 26 passed initially, one new case failed due to an ambiguous test locator (sidebar/card shared label). Scoped the locator to the workspace card and reran all three new cases successfully. Existing 24 cases passed in the initial run. No product code changed after the production build.

New coverage: report_reader only; clinician plus report_reader; report display after refresh; no invoice writes/requests; no mutation controls; reload and correct report sidebar; administrator-only denial. Unit role matrix also checks that report_reader gains no other protected work area and unrelated single roles remain excluded from billing.

Remaining: A/E peer review and merge; live backend evidence if required by reviewer; broader QA-02 stock/traceability/filter/export coverage stays open.
