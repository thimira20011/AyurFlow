# AyurFlow task board

This is the single tracking board for the 64 tasks in the *AyurFlow Team task plan* (1 October 2026). Weeks are relative to implementation kickoff. Task IDs are delivery work; SRS requirement IDs and AT IDs are separate. [Member A's checklist](member-a-tasks.md) gives the detailed order for A's work, and [the implementation plan](implementation-plan.md) gives the sprint gates.

## Assignment and status rules

**Assignment slots are provisional.** The current user has confirmed they are Member B; their personal name and the other team member names have not been supplied. Add the confirmed name for each A–F slot and for the team lead below; then confirm the accountable person and reviewer for **each row**. A review slot is a proposed peer reviewer, not clinic approval. The clinic reviewer for DEC01–06/08 and UAT must be named separately when agreed. Until that happens, `TASK-SET-01` remains in progress.

| Slot | Confirmed name | Primary area | Peer reviewer |
| --- | --- | --- | --- |
| A | Pending | Shared API, auth, audit, deployment | F |
| B | Current user; name pending | Patients and clinical workflow | C |
| C | Pending | Scheduling and session delivery | B |
| D | K. I. R. Perera (`22FIS0506`) | Inventory and preparation | E |
| E | Pending | Billing | D |
| F | Pending | Shared UI, integration and UAT | A |
| Team lead | Pending | Formal clinic/institution coordination | Pending |

Status values: **Pending** = not started; **In progress** = work underway but completion evidence/review missing; **In review** = implementation and evidence ready for the named reviewer; **Done** = stated completion check, dependency integration and review passed; **Blocked** = named decision or external dependency prevents progress. Replace `—` in the Evidence column with a PR, test record, decision or review link. An owner slot alone does not make a task done.

## 1. Requirements and shared contracts (weeks 1–2)

| Task | Deliverable | Owner slot | Peer reviewer | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| TASK-SET-01 | Named assignments, one board, sprint reviews | A coordinates | F | In progress | This board; names/reviews pending |
| TASK-SET-02 | Clinic identity, patient fields, access, pathway | B | C; clinic review | Done | `member-b/confirm-clinic-rules`; interim rules and DEC01–02 open owners/gates recorded. Clinic approval remains a separate UAT gate. |
| TASK-SET-03 | Availability, recipe/expiry and billing examples | C coordinates D/E | B; clinic review | In progress | D's [DEC03 inventory/recipe/expiry review record](inventory-rules-review.md) and [AT08–11 examples](qa/member-d-examples.md) on `member-d/task-set-03-inventory-rules`, plus E's [DEC04 billing review record](billing-rules-review.md); C availability examples and clinic review pending |
| TASK-SET-04 | IDs, units, errors, sessions and retry conventions | A | F; all owners review | Pending | — |
| TASK-SET-05 | Working repo, migrations, synthetic seed and checks | A | F | In progress | Scaffold exists; member startup pending |
| TASK-SET-06 | Shared schema and OpenAPI module boundaries | A coordinates B–E | F; all owners review | In progress | B's [patient/clinical draft](api/member-b-contract.md), D's [inventory/preparation draft](api/member-d-contract.md) on `member-d/task-set-06-inventory-contract`, and E's [billing draft](api/member-e-contract.md); A/C/F review and final migration sequence pending |

## 2. UI and interaction design (weeks 1–6)

| Task | Deliverable | Owner slot | Peer reviewer | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| TASK-UI-01 | Role-based navigation and screen access | F | A; all owners review | In progress | Member B shared-workspace implementation on `member-b/shared-workspace-ui`; [implementation and checks](ui/shared-workspace-implementation.md). F/A review and integrated acceptance remain. |
| TASK-UI-02 | Patient, consultation and plan wireframes | F with B | A | Done | [Wireframes and handoff](ui/member-b-clinical-wireframes.md) merged in [PR #33](https://github.com/thimira20011/AyurFlow/pull/33); collaborator approval and B-confirmed team review. DEC02/08 still gate affected clinical implementation/UAT. |
| TASK-UI-03 | Availability, booking and therapist wireframes | F with C | A | Pending | — |
| TASK-UI-04 | Batch, recipe, preparation and traceability wireframes | F with D | A | Pending | — |
| TASK-UI-05 | Invoice, receipt, balance and admin wireframes | F with E/A | A | Pending | — |
| TASK-UI-06 | Shared layout, forms, tables and error components | F | A | In progress | Shared shell and surface styles on `member-b/shared-workspace-ui`; [implementation and checks](ui/shared-workspace-implementation.md). Remaining module journeys and F/A review stay open. |
| TASK-UI-07 | Keyboard, viewport and Unicode checks | F; owners fix screens | A | Pending | — |

## 3. Authentication and administration (weeks 1–3)

| Task | Deliverable | Owner slot | Peer reviewer | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| TASK-AUTH-01 | Account/role/session schema and Argon2id | A | F | In review | `codex/auth-01-password-seed` (`8277cc7`); Go checks pass; PostgreSQL seed proof and F review pending |
| TASK-AUTH-02 | Login, logout, expiry, revocation, throttling | A | F | In review | Merged PR #12; [PostgreSQL CI passed](https://github.com/thimira20011/AyurFlow/actions/runs/39788040138); DEC07/F/full AT01 pending |
| TASK-AUTH-03 | Backend role/record checks, cookies and CSRF | A | F | Pending | — |
| TASK-AUTH-04 | Login, account/role screens and disabling | A with F | F | Pending | — |
| TASK-AUTH-05 | Transactional audit and restricted retrieval | A | F | In review | `codex/auth-05-audit`; [PostgreSQL/race CI passed](https://github.com/thimira20011/AyurFlow/actions/runs/39791162419); AUTH-03/module integration/F/full AT13 pending |
| TASK-AUTH-06 | AT01 identity/access and safe-log verification | A | F | In progress | Merged frontend repair; `codex/auth-06-fullstack-verification` adds 15 real HTTPS/Next/Go/PostgreSQL cases. [All six CI jobs passed](https://github.com/thimira20011/AyurFlow/actions/runs/41527635069) on `ea2aa3a`; [execution record](auth-06-verification.md#real-full-stack-browser-verification-3-november-2026). F review, trusted deployment, final policy/module gates and full AT01 remain open |

## 4. Patients and consultations (weeks 1–4)

| Task | Deliverable | Owner slot | Peer reviewer | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| TASK-PAT-01 | Patient schema and identifier rules | B | C | In progress | [PR #57](https://github.com/thimira20011/AyurFlow/pull/57) merged matching rules; [PR #63](https://github.com/thimira20011/AyurFlow/pull/63) adds passing [AT02 browser evidence](evidence/member-b-at02-at03-cln05-2026-11-04.md); signed DEC02 source and C review pending |
| TASK-PAT-02 | Registration, search and audited updates | B | C | In progress | PR #57 merged postal fallback and audited updates; PR #63 real protected AT02 browser journey passed; C acceptance review pending |
| TASK-PAT-03 | Registration, search and detail screens | B | C | In progress | PR #57 integrated screens; PR #63 real browser journey passed; [Living Heritage frame alignment](evidence/member-b-figma-alignment-2026-11-04.md) on the Member B follow-up branch; C/F review pending |
| TASK-CON-01 | Consultation/addendum schema and drafts | B | C | In progress | PR #57 merged protected draft and assignment flow; PR #63 real AT03 browser journey passed; C review pending |
| TASK-CON-02 | Signing, immutable text and dated addenda | B | C | In progress | PR #57 merged signing/addenda; PR #63 real browser journey and prior PostgreSQL race checks passed; C review pending |
| TASK-CON-03 | Consultation editor, sign and history UI | B | C | In progress | PR #57 integrated editor; PR #63 real protected AT03 browser journey passed; [Living Heritage frame alignment](evidence/member-b-figma-alignment-2026-11-04.md) on the follow-up branch; C/F review pending |
| TASK-CON-04 | AT02–03 patient/consultation verification | B | C | In progress | [Protected PostgreSQL races](https://github.com/thimira20011/AyurFlow/actions/runs/41236381647) and [real AT02–03 browser evidence](evidence/member-b-at02-at03-cln05-2026-11-04.md) passed; C acceptance review and signed DEC02 source pending |

## 5. Clinical plans and approvals (weeks 3–4)

| Task | Deliverable | Owner slot | Peer reviewer | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| TASK-CLN-01 | One pathway and ordered plan/stage schema | B | C | In progress | PR #57 merged fixed pathway and PostgreSQL guards; signed DEC02 source and C review pending |
| TASK-CLN-02 | Plan, approval and guarded advancement | B | C | In progress | PR #57 merged protected decisions; C/D completion adapters, AT04 and C review pending |
| TASK-CLN-03 | Hold, resume, cancel and history | B with C | C | In progress | PR #57 merged reasoned transitions; C future-session cancellation adapter and AT05 pending |
| TASK-CLN-04 | Shared clearance and plan/start concurrency | B with C | C | In progress | PR #57 merged B's transactional clearance hook and race test; C session-start join pending |
| TASK-CLN-05 | Plan timeline and clinician actions UI | B | C | In progress | [PR #63](https://github.com/thimira20011/AyurFlow/pull/63) clinician browser case and all updated CI jobs passed; [revised 1366/1024 Living Heritage comparison](evidence/member-b-figma-alignment-2026-11-04.md) awaits C/F review |
| TASK-CLN-06 | AT04–05 transition verification | B | C; clinic examples | In progress | PR #57 PostgreSQL lifecycle and HTTP tests passed; C/D joins and integrated AT04–05 pending |

## 6. Scheduling and session delivery (weeks 2–4)

| Task | Deliverable | Owner slot | Peer reviewer | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| TASK-SCH-01 | Rooms, availability, sessions and allocation schema | C | B | Pending | — |
| TASK-SCH-02 | Availability changes with conflict protection | C | B | Pending | — |
| TASK-SCH-03 | Booking and atomic rescheduling | C | B | Pending | — |
| TASK-SCH-04 | Start, observations, completion and cancellation | C with B | B | Pending | — |
| TASK-SCH-05 | Booking/availability/therapist screens | C | B | Pending | — |
| TASK-SCH-06 | AT06–07 overlap and clearance verification | C | B | Pending | — |

## 7. Inventory and preparation (weeks 2–6)

| Task | Deliverable | Owner slot | Peer reviewer | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| TASK-INV-01 | Botanical batches, receipt, block, eligibility | D | E | Pending | — |
| TASK-INV-02 | Flat recipes and scaled ingredients | D | E | Pending | — |
| TASK-INV-03 | Immutable saved preparation snapshots | D | E | Pending | — |
| TASK-INV-04 | Manual batch allocation and atomic consumption | D | E | Pending | — |
| TASK-INV-05 | Unique confirmation and safe retries | D | E | Pending | — |
| TASK-INV-06 | Actual traceability and stock queries | D | E | Pending | — |
| TASK-INV-07 | Batch/recipe/preparation/traceability screens | D | E | Pending | — |
| TASK-INV-08 | AT08–11 inventory/preparation verification | D | E | Pending | — |

## 8. Invoicing and receipts (weeks 2–6)

| Task | Deliverable | Owner slot | Peer reviewer | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| TASK-BILL-01 | Invoice/receipt schema and integer LKR | E | D | In review | Merged in PR #17; migration `000004_billing.up.sql` live in `dev` |
| TASK-BILL-02 | Draft editing and atomic invoice issue | E | D | In review | `member-e/task-bill-02-invoice-lifecycle`; routes wired under `RequireSession` in `router.go`, atomic issue, item lines, role checks, frontend workspace, DEC04 review record; Go & Next.js test suites pass |
| TASK-BILL-03 | Direct receipts, deposits and balance | E | D | In review | `member-e/task-bill-03-receipts-balance`; direct receipts, labelled bank deposits, derived balance, overpayment conflict guard, idempotent operation ID, HTTP routes (`/api/v1/invoices/:id/receipts`, `/api/v1/invoices/:id/balance`), transaction audit logging, and Go & Next.js test suites passing |
| TASK-BILL-04 | Unique receipt operations and concurrency | E | D | In review | `member-e/task-bill-04-receipt-concurrency`; HTTP 200 OK on idempotent replay vs 201 Created on new receipt; concurrent race serialization via pg_advisory_xact_lock + FOR UPDATE locks; overpayment overflow guard; Go test suite passing |
| TASK-BILL-05 | Invoice editor, issued view, receipt/history UI | E | D | In review | `member-e/task-bill-05-billing-ui`; billing workspace wired to live /api/v1 endpoints with session gate, preview fallback, invoice detail + receipt history drawer, live balance banner, outstanding report tab, loading/error handling; npm test 15/15 pass, npm run lint and typecheck clean |
| TASK-BILL-06 | Outstanding report and AT12 verification | E | D | Pending | — |

## 9. Reports and integrated testing (weeks 5–8)

| Task | Deliverable | Owner slot | Peer reviewer | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| TASK-QA-01 | Requirement/test checklist and synthetic journey data | F; all owners supply examples | A | In progress | B's [synthetic AT02–05 examples](qa/member-b-examples.md) and D's [synthetic AT08–11 examples](qa/member-d-examples.md) (`tests/fixtures/member-d-cases.json`); F/A review and other modules pending |
| TASK-QA-02 | Authorized report navigation | F with D/E; A checks access | A | Pending | — |
| TASK-QA-03 | Patient-to-receipt walkthrough | F; owners fix modules | A | Pending | — |
| TASK-QA-04 | Critical audit and permission sweep | A with F | F | Pending | — |
| TASK-QA-05 | Performance and viewport/keyboard evidence | F; A supports host | A | Pending | — |
| TASK-QA-06 | Clinic UAT, triage and acceptance record | F; owners attend | A; clinic review | Pending | — |

## 10. Deployment and handover (weeks 1–10)

| Task | Deliverable | Owner slot | Peer reviewer | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| TASK-OPS-01 | Compose, configuration, HTTPS and pilot deployment | A | F | Pending | — |
| TASK-OPS-02 | Encrypted daily backup and isolated restore | A | F; clinic operations review | Pending | — |
| TASK-OPS-03 | Usage, outage, API/setup and migration guides | F assembles; each owner writes module | A | In progress | B's [patient/clinical guide](guides/member-b-staff.md) reflects the current guarded plan actions, with [author check and verifier handoff](evidence/member-b-ops-03-guide-2026-11-07.md); A's [administration guide](guides/member-a-administration.md)/[operations runbook](operations.md), A slice on `codex/ops-03-admin-runbook`. Named-member walkthroughs and F/A assembly/review pending |
| TASK-OPS-04 | Clean startup, migrations, seed and restart | A with F | F | In progress | `codex/ops-04-clean-start`; [isolated pilot-image verification](../deploy/verification/README.md) and [execution record](testing.md#task-ops-04-clean-startup-and-persistence-7-november-2026). Independent walkthrough/review and full AT17 remain open. |
| TASK-OPS-05 | Data authorization, custody and support decisions | Team lead; A handles operations | Clinic/institution | Pending | — |
| TASK-OPS-06 | Training, release and handover | F; all owners teach modules | A; clinic recipient | Pending | — |

## Review rhythm

1. **At kickoff:** fill confirmed names, assign the team lead and external reviewers, and record the implementation kickoff date. Recheck every row with its accountable person and reviewer.
2. **Weekly integration review:** each owner shows changed behavior, contract/migration changes, dependencies, test evidence and blockers. Update row status and evidence. Record DEC01–08 decisions in [decisions.md](decisions.md), with decision maker and date.
3. **Every two-week sprint boundary:** demonstrate the exit check in [team-plan.md](team-plan.md), record accepted/failed AT cases in [testing.md](testing.md), and triage defects. A task is Done only after its stated check, integrated dependency and independent review pass.
4. **Before a PR:** link the branch/PR and check output to the row. The user reviews and opens PRs manually; a pushed branch is not a merged or accepted task.
