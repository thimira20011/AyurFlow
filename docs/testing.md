# Verification plan and evidence

Starter automated checks cover Go build/vet, health-vs-readiness behavior, frontend ESLint, TypeScript and production build. These are foundation checks, not pilot acceptance.

Scaffold verification on 2 October 2026: Go formatting, vet, tests and both command builds passed; frontend lint, typecheck and production build passed; JSON and YAML syntax checks passed. Docker is not installed on the verification machine, so container startup, SQL execution and restart persistence remain unverified. No AT01-AT17 result is marked passed.

| Test | Scope | Proposed owner | Status |
| --- | --- | --- | --- |
| AT01 | Accounts, sessions, CSRF, roles and record restrictions | A | Pending |
| AT02 | Optional identity, duplicate race, Unicode search, demographic audit | B | Pending |
| AT03 | Draft/sign locking race and preserved dated addenda | B | Pending |
| AT04 | Ordered plan and clinician approval; current-stage clearance | B/C | Pending |
| AT05 | Hold/resume/cancel, retained history and hold/start race | B/C | Pending |
| AT06 | Availability, adjacent/overlapping booking races, atomic rescheduling | C | Pending |
| AT07 | Assigned therapist delivery and cancellation boundaries | C | Pending |
| AT08 | Batch receipt/block and expiry/eligibility | D | Pending |
| AT09 | Recipe scaling, immutable snapshot, no preparation deduction | D | Pending |
| AT10 | Consumption retries, races, insufficiency and complete rollback | D | Pending |
| AT11 | Bidirectional actual traceability and report permissions | D/F | Pending |
| AT12 | Locked invoice, deposit, balance, receipt retries/races and retention | E | Pending |
| AT13 | Reference/report access, critical audit and failed-audit rollback | A/all | Pending |
| AT14 | 10 minutes, 5 users, 500 patients, 1000 sessions, 200 batches; p95 <2s on three queries | F | Pending |
| AT15 | 1366×768 and 1024×768, keyboard, labels, Unicode, errors | F/all | Pending |
| AT16 | Outage re-entry and encrypted isolated restore of four record categories | A/F | Pending |
| AT17 | Clean startup, migrations, seed, restart persistence, docs and handover | A/F | Pending |

For each result record setup, steps, expected/actual behavior, tester, date, application version, environment and evidence location. Store synthetic fixtures in `tests/fixtures`, PostgreSQL tests in `tests/integration`, and browser scenarios in `tests/e2e`. Record unresolved defects rather than marking them passed.
