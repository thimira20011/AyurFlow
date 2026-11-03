# Member B code verification — 2–3 November 2026

- **Branch/version:** `member-b/patient-clinical-completion` at `d8f13b8` (includes explicit NOT_STARTED → PREPARATORY start, terminal plan guard, patient postal fallback and consultation workflow).
- **Tester/environment:** Codex automated checks for Member B, synthetic records only. [GitHub Actions run 41489926492](https://github.com/thimira20011/AyurFlow/actions/runs/41489926492) used Go 1.27.3 and disposable PostgreSQL 17.11 on Ubuntu; backend, integration, security, frontend and deployment jobs all passed.
- **CI command:** `go test -race -tags=integration -shuffle=on -count=1 -timeout=5m -json ./...`.
- **AT02 setup/steps:** migrated disposable database; register duplicate normalized identities concurrently, confirm phone and postal fallback matches, update demographics and force audit rollback. **Expected:** generic duplicate conflict, no unauthorized record leak, audited updates or total rollback. **Actual:** the named protected HTTP tests below passed in CI. This is implementation evidence, not final AT02 acceptance.
- **AT03 setup/steps:** create/edit/sign consultation through protected HTTP, race edit against sign, reject signed-row updates, append dated correction. **Expected:** immutable signed original and separate author/time/reason addendum. **Actual:** the named protected HTTP race test below passed in CI. This is implementation evidence, not final AT03 acceptance.
- **AT04 setup/steps:** create a NOT_STARTED plan, start PREPARATORY, reject future-stage approval, require signed consultation and exact checks, prove audit rollback, hold/start lock serialization, hold/resume/cancel behavior and terminal history guard. **Expected:** ordered, versioned transitions and fail-closed missing C/D completion evidence. **Actual:** the three named clinical/HTTP tests below passed in CI. C's real scheduling and D's preparation adapters remain unimplemented, so integrated AT04–05 acceptance is pending.
- **Selected raw CI JSON outcomes** (full log at the linked run):

  ```text
  {"Time":"2026-11-02T17:21:35.793434604Z","Action":"pass","Package":"ayurflow/backend/internal/clinical","Test":"TestPlanActionsIntegration","Elapsed":0.74}
  {"Time":"2026-11-02T17:21:37.103446751Z","Action":"pass","Package":"ayurflow/backend/internal/clinical","Test":"TestPlanHoldResumeCancelAndClearanceIntegration","Elapsed":0.83}
  {"Time":"2026-11-02T17:21:43.335656217Z","Action":"pass","Package":"ayurflow/backend/internal/transport/http","Test":"TestPostalFallbackProtectedPatientIntegration","Elapsed":0.48}
  {"Time":"2026-11-02T17:21:47.414127826Z","Action":"pass","Package":"ayurflow/backend/internal/transport/http","Test":"TestAT02DuplicateIdentityHTTPIntegration","Elapsed":0.48}
  {"Time":"2026-11-02T17:21:48.637626513Z","Action":"pass","Package":"ayurflow/backend/internal/transport/http","Test":"TestAT03SignEditHTTPRaceIntegration","Elapsed":0.75}
  {"Time":"2026-11-02T17:21:49.523728183Z","Action":"pass","Package":"ayurflow/backend/internal/transport/http","Test":"TestProtectedPlanPathwayIntegration","Elapsed":0.88}
  ```
- **Local frontend command outputs:** `npm test`: 13 passed, 0 failed; `npm run typecheck`: passed; `npm run lint`: passed; `node node_modules/next/dist/bin/next build --webpack`: compiled, generated 17 static pages and built `/clinical/plans`. Local `npm run build` with Turbopack failed on Windows while starting a child process for `patient-workspace.module.css`; the same branch's CI frontend build passed.
- **Local PostgreSQL environment:** Docker Desktop Linux engine remained unavailable after reset (`docker info` reported a missing `dockerDesktopLinuxEngine` pipe). Ubuntu 24.04 WSL supplied PostgreSQL 16.15 and a disposable `ayurflow_go_test` database. The official Go 1.27.3 Linux archive was downloaded and verified against its published SHA256 `65efbc80fdc1fa2cd2631cad5b481777a68e8725f34e89f50fc6ac714e379b40`. [All 14 forward SQL migrations applied locally](member-b-local-postgres-migrations-2026-11-02.txt).
- **Local AT02–AT04 command/output (3 November 2026, Asia/Colombo):** `TEST_DATABASE_URL='postgres://ravindu@/ayurflow_go_test?host=/var/run/postgresql' go test -race -tags=integration -shuffle=on -count=1 -timeout=5m -json ./internal/patients ./internal/consultations ./internal/clinical ./internal/transport/http` exited **0**. The [complete local JSON test log](member-b-local-at02-at03-at04-2026-11-03.jsonl) contains 380 events: all four packages passed, zero failed tests and zero skipped tests. Selected raw outcomes:

  ```text
  {"Action":"pass","Package":"ayurflow/backend/internal/clinical","Test":"TestPlanActionsIntegration","Elapsed":1.61}
  {"Action":"pass","Package":"ayurflow/backend/internal/consultations","Test":"TestConsultationSigningAndAddendaIntegration","Elapsed":1.2}
  {"Action":"pass","Package":"ayurflow/backend/internal/clinical","Test":"TestPlanHoldResumeCancelAndClearanceIntegration","Elapsed":1.96}
  {"Action":"pass","Package":"ayurflow/backend/internal/patients","Test":"TestPatientServiceIntegration","Elapsed":1.82}
  {"Action":"pass","Package":"ayurflow/backend/internal/transport/http","Test":"TestAT03SignEditHTTPRaceIntegration","Elapsed":3.05}
  {"Action":"pass","Package":"ayurflow/backend/internal/patients","Test":"TestPostalFallbackIdentityConfirmationIntegration","Elapsed":1.17}
  {"Action":"pass","Package":"ayurflow/backend/internal/transport/http","Test":"TestProtectedPlanPathwayIntegration","Elapsed":1.69}
  {"Action":"pass","Package":"ayurflow/backend/internal/transport/http","Test":"TestPostalFallbackProtectedPatientIntegration","Elapsed":0.91}
  {"Action":"pass","Package":"ayurflow/backend/internal/transport/http","Test":"TestAT02DuplicateIdentityHTTPIntegration","Elapsed":0.94}
  ```
- **Additional full repository run:** The [full local `./...` JSON log](member-b-local-go-integration-2026-11-02.jsonl) contains passing Member B packages but exits **1** because the unrelated `backend/db/TestPilotRuntimePrivilegesIntegration` requires PostgreSQL role-creation privilege; the disposable `ravindu` database role has `CREATEDB` but no `CREATEROLE` (`SQLSTATE 42501`). This is an environment permission limitation, not an AT02–AT04 failure. The five-job CI run above passed with its configured PostgreSQL privileges.
- **Acceptance status:** Pending C Review & Integration Evidence. Signed DEC02 source, browser staff journeys and C/D integration evidence are still required for final sign-off.
