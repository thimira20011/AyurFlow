# Member C branch security synchronization — 12 November 2026

Scope: TASK-SET-05 toolchain maintenance and TASK-QA-04 security support (SRS NFR-04, supporting AT17). Shared owner A, reviewer F; C reproduces and integrates the existing owner fix for the Member C branch. No feature acceptance or clinic approval is claimed.

PR #83 runs both push checks on its branch and pull-request checks on the merged result. Inspection found 16 checks: 15 passed and the push security job failed; all eight pull-request jobs passed. The user earlier observed two failures; only one failure remained at inspection, and no second root cause is inferred.

The [failed push security job](https://github.com/thimira20011/AyurFlow/actions/runs/43231884403/job/131229281280) reports reachable standard-library advisory GO-2026-6859 in net/http on Go 1.27.3 and identifies 1.27.4 as fixed. This is a security scan failure, not a failing scheduling assertion. PR #82 already merged A's patch into dev at 83a2cffeec0688e9715d374ad78fb152e02eafef; PR #83's branch was created from the older baseline c6a44fa.

The fix branch codex/member-c-ci-security-sync integrates that exact existing patch: module minimum, Docker build, four CI Go setup steps and current setup instructions use Go 1.27.4. Historical evidence keeps the version actually used. Security scans and every test gate stay enabled. The Member C checklist is preserved.

Validation: local git diff --check passes; actual build, security, PostgreSQL, browser and clean-start verification requires the new branch's CI. The earlier local Go/Node/PostgreSQL setup blockers still apply. Record CI results after completion; do not merge into dev until all required checks pass and review completes.
