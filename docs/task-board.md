# AyurFlow task board

This is the single tracking board for the 64 tasks in the *AyurFlow Team task plan* (1 October 2026). Weeks are relative to implementation kickoff. Task IDs are delivery work; SRS requirement IDs and AT IDs are separate. [Member A's checklist](member-a-tasks.md) gives the detailed order for A's work, and [the implementation plan](implementation-plan.md) gives the sprint gates.

## Assignment and status rules

**Assignment slots are provisional.** The current user has confirmed they are Member B; their personal name and the other team member names have not been supplied. Add the confirmed name for each A–F slot and for the team lead below; then confirm the accountable person and reviewer for **each row**. A review slot is a proposed peer reviewer, not clinic approval. The clinic reviewer for DEC01–06/08 and UAT must be named separately when agreed. Until that happens, `TASK-SET-01` remains in progress.

| Slot | Confirmed name | Primary area | Peer reviewer |
| --- | --- | --- | --- |
| A | Pending | Shared API, auth, audit, deployment | F |
| B | Current user; name pending | Patients and clinical workflow | C |
| C | Pending | Scheduling and session delivery | B |
| D | Pending | Inventory and preparation | E |
| E | Pending | Billing | D |
| F | Pending | Shared UI, integration and UAT | A |
| Team lead | Pending | Formal clinic/institution coordination | Pending |

Status values: **Pending** = not started; **In progress** = work underway but completion evidence/review missing; **In review** = implementation and evidence ready for the named reviewer; **Done** = stated completion check, dependency integration and review passed; **Blocked** = named decision or external dependency prevents progress. Replace `—` in the Evidence column with a PR, test record, decision or review link. An owner slot alone does not make a task done.

## 1. Requirements and shared contracts (weeks 1–2)

| Task | Deliverable | Owner slot | Peer reviewer | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| TASK-SET-01 | Named assignments, one board, sprint reviews | A coordinates | F | In progress | This board; names/reviews pending |
| TASK-SET-02 | Clinic identity, patient fields, access, pathway | B | C; clinic review | Done | `member-b/confirm-clinic-rules`; interim rules and DEC01–02 open owners/gates recorded. Clinic approval remains a separate UAT gate. |
| TASK-SET-03 | Availability, recipe/expiry and billing examples | C coordinates D/E | B; clinic review | Pending | — |
| TASK-SET-04 | IDs, units, errors, sessions and retry conventions | A | F; all owners review | Pending | — |
| TASK-SET-05 | Working repo, migrations, synthetic seed and checks | A | F | In progress | Scaffold exists; member startup pending |
| TASK-SET-06 | Shared schema and OpenAPI module boundaries | A coordinates B–E | F; all owners review | In progress | B's [patient/clinical draft](api/member-b-contract.md) on `member-b/schema-api-contracts`; A/C/F review, other modules and migration sequence pending |

## 2. UI and interaction design (weeks 1–6)

| Task | Deliverable | Owner slot | Peer reviewer | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| TASK-UI-01 | Role-based navigation and screen access | F | A; all owners review | Pending | — |
| TASK-UI-02 | Patient, consultation and plan wireframes | F with B | A | Done | [Wireframes and handoff](ui/member-b-clinical-wireframes.md) merged in [PR #33](https://github.com/thimira20011/AyurFlow/pull/33); collaborator approval and B-confirmed team review. DEC02/08 still gate affected clinical implementation/UAT. |
| TASK-UI-03 | Availability, booking and therapist wireframes | F with C | A | Pending | — |
| TASK-UI-04 | Batch, recipe, preparation and traceability wireframes | F with D | A | Pending | — |
| TASK-UI-05 | Invoice, receipt, balance and admin wireframes | F with E/A | A | Pending | — |
| TASK-UI-06 | Shared layout, forms, tables and error components | F | A | Pending | — |
| TASK-UI-07 | Keyboard, viewport and Unicode checks | F; owners fix screens | A | Pending | — |

## 3. Authentication and administration (weeks 1–3)

| Task | Deliverable | Owner slot | Peer reviewer | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| TASK-AUTH-01 | Account/role/session schema and Argon2id | A | F | In review | `codex/auth-01-password-seed` (`8277cc7`); Go checks pass; PostgreSQL seed proof and F review pending |
| TASK-AUTH-02 | Login, logout, expiry, revocation, throttling | A | F | In review | Merged PR #12; [PostgreSQL CI passed](https://github.com/thimira20011/AyurFlow/actions/runs/39788040138); DEC07/F/full AT01 pending |
| TASK-AUTH-03 | Backend role/record checks, cookies and CSRF | A | F | Pending | — |
| TASK-AUTH-04 | Login, account/role screens and disabling | A with F | F | Pending | — |
| TASK-AUTH-05 | Transactional audit and restricted retrieval | A | F | In review | `codex/auth-05-audit`; [PostgreSQL/race CI passed](https://github.com/thimira20011/AyurFlow/actions/runs/39791162419); AUTH-03/module integration/F/full AT13 pending |
| TASK-AUTH-06 | AT01 identity/access and safe-log verification | A | F | Pending | — |

## 4. Patients and consultations (weeks 1–4)

| Task | Deliverable | Owner slot | Peer reviewer | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| TASK-PAT-01 | Patient schema and identifier rules | B | C | In progress | [PR #19](https://github.com/thimira20011/AyurFlow/pull/19); isolated PostgreSQL schema test passed; A number, C/DEC02 review and AT02 integration pending |
| TASK-PAT-02 | Registration, search and audited updates | B | C | In progress | [PR #22](https://github.com/thimira20011/AyurFlow/pull/22); [PostgreSQL CI passed](https://github.com/thimira20011/AyurFlow/actions/runs/40089021544); AUTH-03/CSRF, DEC02, C review and AT02 integration pending |
| TASK-PAT-03 | Registration, search and detail screens | B | C | In progress | [PR #29](https://github.com/thimira20011/AyurFlow/pull/29) merged; development-only synthetic preview; [CI passed](https://github.com/thimira20011/AyurFlow/actions/runs/40177536481); shared sign-in/UI, DEC02/07, C review and AT02 journey pending |
| TASK-CON-01 | Consultation/addendum schema and drafts | B | C | In progress | [PR #32](https://github.com/thimira20011/AyurFlow/pull/32) merged; follow-up `member-b/con-01-clinical-access` proposes assignment source, protected draft handlers and tests; A migration number, DEC02 grant authority, live registration, C review and AT03 pending |
| TASK-CON-02 | Signing, immutable text and dated addenda | B | C | In progress | `member-b/signing-addenda`; follow-up [PR #42](https://github.com/thimira20011/AyurFlow/pull/42) passed [protected HTTP and PostgreSQL CI](https://github.com/thimira20011/AyurFlow/actions/runs/40652220332); live registration, A migration number, DEC02, C review and AT03 pending |
| TASK-CON-03 | Consultation editor, sign and history UI | B | C | In progress | `member-b/consultation-screens`: editor/history and development-only synthetic preview; [branch CI passed](https://github.com/thimira20011/AyurFlow/actions/runs/40399408858); protected clinical HTTP, DEC02, F shared UI, C review and AT03 pending |
| TASK-CON-04 | AT02–03 patient/consultation verification | B | C | Pending | — |

## 5. Clinical plans and approvals (weeks 3–4)

| Task | Deliverable | Owner slot | Peer reviewer | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| TASK-CLN-01 | One pathway and ordered plan/stage schema | B | C | In progress | `member-b/cln-01-pathway-schema` adds schema and PostgreSQL test; A migration number, DEC02 labels/checklist and C review pending |
| TASK-CLN-02 | Plan, approval and guarded advancement | B | C | Pending | — |
| TASK-CLN-03 | Hold, resume, cancel and history | B with C | C | Pending | — |
| TASK-CLN-04 | Shared clearance and plan/start concurrency | B with C | C | Pending | — |
| TASK-CLN-05 | Plan timeline and clinician actions UI | B | C | Pending | — |
| TASK-CLN-06 | AT04–05 transition verification | B | C; clinic examples | Pending | — |

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
| TASK-BILL-04 | Unique receipt operations and concurrency | E | D | Pending | — |
| TASK-BILL-05 | Invoice editor, issued view, receipt/history UI | E | D | Pending | — |
| TASK-BILL-06 | Outstanding report and AT12 verification | E | D | Pending | — |

## 9. Reports and integrated testing (weeks 5–8)

| Task | Deliverable | Owner slot | Peer reviewer | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| TASK-QA-01 | Requirement/test checklist and synthetic journey data | F; all owners supply examples | A | In progress | B's [synthetic AT02–05 examples](qa/member-b-examples.md) on `member-b/clinical-test-examples`; F/A review and other modules pending |
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
| TASK-OPS-03 | Usage, outage, API/setup and migration guides | F assembles; each owner writes module | A | In progress | B's [patient and clinical staff guide](guides/member-b-staff.md) on `member-b/ops-03-usage-guide` ready for synthetic walkthrough; F/A assembly and verification pending |
| TASK-OPS-04 | Clean startup, migrations, seed and restart | A with F | F | Pending | — |
| TASK-OPS-05 | Data authorization, custody and support decisions | Team lead; A handles operations | Clinic/institution | Pending | — |
| TASK-OPS-06 | Training, release and handover | F; all owners teach modules | A; clinic recipient | Pending | — |

## Review rhythm

1. **At kickoff:** fill confirmed names, assign the team lead and external reviewers, and record the implementation kickoff date. Recheck every row with its accountable person and reviewer.
2. **Weekly integration review:** each owner shows changed behavior, contract/migration changes, dependencies, test evidence and blockers. Update row status and evidence. Record DEC01–08 decisions in [decisions.md](decisions.md), with decision maker and date.
3. **Every two-week sprint boundary:** demonstrate the exit check in [team-plan.md](team-plan.md), record accepted/failed AT cases in [testing.md](testing.md), and triage defects. A task is Done only after its stated check, integrated dependency and independent review pass.
4. **Before a PR:** link the branch/PR and check output to the row. The user reviews and opens PRs manually; a pushed branch is not a merged or accepted task.
