# Billing and payment rules review — DEC04

This is the review record for Member E (`TASK-BILL-01` through `TASK-BILL-06`; clinic billing reviewer and Member D peer reviewer). It turns the open billing and payment decisions in SRS v1.0 into concrete questions for review and signoff. Member E has confirmed their role on branch `member-e/task-bill-02-invoice-lifecycle`. **No clinic-specific answer or real billing approval is recorded yet.** The requirements below establish the SRS baseline and synthetic development invariants; they do not substitute for clinic signoff. Keep `docs/decisions.md` marked pending until the relevant reviewers approve a dated answer.

## Review record

| Item | Value to record |
| --- | --- |
| Project and institution | AyurFlow — Group 04, IS5109 Community Project; Sabaragamuwa University of Sri Lanka, Faculty of Computing, Department of Computing and Information Systems (SRS v1.0 document control) |
| Clinic billing reviewer name and role | Pending clinic appointment |
| Team Member E name | Role confirmed by current user (Member E); name pending team confirmation |
| Peer reviewer (Member D) | Member D (Inventory / Dispensary) |
| Review date and SRS version | Pending; SRS v1.0 is the current review baseline |
| Evidence location (signed notes, invoice samples, tariff schedule) | Pending; store approved evidence in `docs/evidence/` or clinic archive |
| Outcome | Pending — approved, approved with conditions, or returned for revision |

Do not put real financial account numbers, patient records, or payment gateway secrets in this repository. Record the approved rules and a reference to review evidence here.

## Working rules for development

The current user has directed billing implementation to proceed with synthetic data. The rules in this section represent the **provisional development contract**, not final clinic answers. They allow the database schema, Go service logic, transactional audit, and Next.js interface to be built and verified against AT12. The open questions and gates below remain active for billing UAT and any real-data pilot.

| Topic | Interim rule for synthetic development | Open gate and accountable owner |
| --- | --- | --- |
| Currency & precision | Store all monetary values as integer LKR minor units (`BIGINT` in PostgreSQL, `int64` in Go, integer cents in JSON). No floating-point arithmetic. Displayed formatted as `LKR 12,500.00` in Asia/Colombo context. | E and clinic billing officer confirm whether fractional minor units or statutory discounts exist before billing UAT. |
| Invoicing lifecycle | Invoices start as `draft`. Drafts permit adding/removing line items. Issuance is atomic: validates at least one item, computes `total_minor`, sets `issued_at` and `issued_by`, transitions status to `issued`, and writes transactional audit. Issued invoices are immutable: any edit attempt returns `409 Conflict`. | E and clinic billing officer verify whether drafts can expire or auto-void if unissued. |
| Receipts & deposits | Receipts attach to `issued` invoices. Each receipt mutation requires a client-generated UUIDv4 `operation_id` for idempotent retry safety. Overpayments are strictly blocked (receipt amount must not exceed `total_minor - sum(receipts)`). | E, D, and clinic reviewer confirm advance deposit handling and whether partial deposits can precede therapy scheduling. |
| Role permissions | Enforced transactional role check with `FOR SHARE` row locks on staff and roles tables. `billing` and `receptionist` roles can create drafts, add items, issue, void drafts, and post receipts. `report_reader` can access aging and outstanding reports. Administrator alone has no billing mutation permissions. | E and A review backend role enforcement contract; clinic confirms staff role assignments under DEC04. |
| Statutory receipt fields | Receipts record receipt ID, invoice ID, operation ID, amount in minor units, payment method (`cash`, `card`, `bank_transfer`, `direct_deposit`, `other`), optional label, UTC issued timestamp, and issuing staff account ID. | Clinic billing officer provides required statutory printed receipt layout and tax identification requirements. |
| Error correction | An issued invoice cannot be deleted or rewritten. If issued in error before receipting, clinic staff can record a void with an audit reason. For paid invoices, reconciliation adjustments require explicit addendum receipts or clinic manager action. | E and clinic billing reviewer confirm dispute and credit note workflows before Sprint 3 acceptance. |

## DEC04 — billing and payment questions (before Sprint 3 acceptance)

| Question for clinic billing officer and Member E | Recorded rule / example |
| --- | --- |
| What is the clinic's standard tariff catalog (consultation fees, therapy package rates, kashaya decoction prices)? Are rates fixed clinic-wide or variable by physician seniority? | Synthetic catalog established in `frontend/src/features/billing/billing-workspace.tsx` (consultations: LKR 2,500; Abhyanga: LKR 4,500; Shirodhara: LKR 6,500; Swedana: LKR 2,000; Kashaya: LKR 1,200). Official clinic tariff confirmation pending. |
| At what point must an invoice be issued (prior to therapy session, immediately post-consultation, or at discharge)? | Synthetic rule: Drafts can be opened post-consultation and issued atomically when therapies are finalized. Confirmation pending. |
| Can a patient pay an advance deposit prior to consultation or scheduling, and how should unallocated deposits map to future invoices? | Interim rule: Receipts attach to an issued invoice ID. Future deposit allocation gate pending clinic review. |
| What statutory tax lines (e.g. VAT, SSCL) or clinic service charges apply, and how must they appear on receipts? | Interim rule: Exact integer minor units without auto-applied VAT until clinic tax status is confirmed. |
| What receipt number sequence or physical receipt book format is required for audit and patient handoff? | Synthetic rule: Server-assigned UUID/prefixed IDs (`rec-...`) with operation ID deduplication. Clinic physical receipt alignment pending. |
| What is the procedure if a patient disputes an invoice or therapies are modified after invoice issuance? | Synthetic rule: Issued invoices are immutable; voiding is restricted. Credit note / adjustment procedure pending clinic decision. |

DEC04 is closed when the clinic billing reviewer and Member E sign off on the tariff schedule, receipt layout, deposit timing, and dispute rules, with signed evidence filed in the agreed location.
