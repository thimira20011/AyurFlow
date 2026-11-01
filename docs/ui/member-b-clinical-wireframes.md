# TASK-UI-02 — patient and clinical screen wireframes

**TASK-UI-02 design complete.** [Open the visual wireframes](member-b-clinical-wireframes.html). They use synthetic labels, show intended screen structure, and do not implement clinical routes or record access. F owns the shared design system; A is the task reviewer. B owns the patient and clinical rules represented here. The wireframes were merged in [PR #33](https://github.com/thimira20011/AyurFlow/pull/33), approved by a collaborator on 26 October 2026. Member B confirmed on 27 October 2026 that the team reviewed and approved the design. The tracker does not map reviewer account names to A/F/C roles, so this records the user's team-review confirmation rather than inventing named sign-offs.

## Scope and source

This proposal covers patient search/registration/detail, consultation draft/sign/addendum history, and the ordered care-plan timeline with approval, advancement, hold, resume and cancellation states. It follows [the implementation plan](../implementation-plan.md), [B's API contract](../api/member-b-contract.md), and [the DEC02 review record](../clinic-rules-review.md). The patient layout reflects the existing `/patients` screen; consultation and care-plan layouts are proposals for later feature tasks. SRS PAT-01–02, CON-01–03 and CLN-01–06 map to AT02–05. TASK-UI-02 is design work and does not pass any AT.

## Screen map

| Screen | Primary question and action | Information shown | Access boundary |
| --- | --- | --- | --- |
| Patient registry | Is this patient already registered? Search before register. | Bounded permitted results and demographics; selected patient ID, name, optional identity and phone. | Reception sees permitted demographics only. No note text or plan decisions. Results must be filtered by backend record access before pagination. |
| Consultation | Is this a draft or a signed record? Save draft, sign, or add a dated correction. | Patient context, draft editor and version; signed original read-only; addenda with author, time and reason in order. | Only an active clinician with patient-record access. No note body in list summary, non-clinical view, audit or error text. |
| Care plan | What is the current stage and which decision is allowed now? Approve/advance/hold/resume/cancel. | Plan state separate from stage state; ordered stage timeline; decision actor/time, completed history and reasoned hold/cancel notice. | Assigned clinician sees decision detail and allowed actions. Therapist receives only C's minimum session projection; booking does not grant start clearance. |

## Interaction contract for F

1. Keep one patient context header through the clinical screens: permitted name and internal ID, with a return link to patient search. If a deep link loses record access, show a generic unavailable state without the other patient's details.
2. Use status words alongside colour: **Draft**, **Signed**, **Current**, **Approved**, **Held**, **Cancelled**, **Completed**. The plan's status and the current stage's status need separate labels. Do not style a booking as clinical clearance.
3. Draft editing uses a visible Save action and version token. A stale edit or competing sign shows a conflict and a reload action; never silently overwrite text. The sign action must ask for explicit confirmation and show the immutable effect. The signed original remains read-only; correction is a separate dated addendum with reason.
4. Plan actions show only when the backend says the actor may use them. A confirmation step for hold/cancel states what will happen to *new* starts and future unstarted sessions. A final cancellation cannot be reversed by a UI control. A held plan retains approvals and history; its action area offers Resume to an authorized clinician, subject to DEC08.
5. All mutation controls need a pending state that prevents duplicate submission, a success acknowledgement, field-level validation, and a recoverable failure state. A 409 conflict asks for reload and review. A failed audit write appears as a failed action; never show success from optimistic local state.
6. Keep keyboard order aligned to visual order. Use real labels and errors linked to fields, a visible focus indicator, and an announced outcome for async actions. At 1024 × 768, sections stack and actions remain readable; at 1366 × 768, list/timeline and detail can appear beside each other. F verifies AT15 with implemented screens later.

## State coverage for implementation

| State | Patient | Consultation | Care plan |
| --- | --- | --- | --- |
| First/empty | Search prompt, no implied results. | No consultations; authorized clinician may begin a draft without a plan. | No plan; authorized clinician may start one only after pathway rules are approved. |
| Loading/unavailable | Search/detail loading or patient service unavailable. | Detail loading or clinical service unavailable; do not expose cached note text across session loss. | Timeline loading or unavailable; do not infer current clearance. |
| Forbidden/inaccessible | Generic access message; inaccessible record does not appear in results. | Generic unavailable record and no body. | Generic unavailable plan and no decisions. |
| Conflict | Duplicate supplied identity or stale demographic version; search/reload. | Stale draft/sign race; reload the current draft or signed record. | Stale approval/advance/hold/start decision; reload the plan and session state. |
| Historical | Show demographic update result without clinical history. | Signed original and dated addenda stay distinct and read-only. | Completed stages and decision actor/time remain visible after hold/cancel. |

## Review gates and handoff

| Reviewer | Requested decision | Status |
| --- | --- | --- |
| F — accountable UI owner | Confirm shared navigation, component patterns, responsive layout, field/action copy and how these wireframes join TASK-UI-06. | Team review and approval reported by B on 27 October 2026; [PR #33](https://github.com/thimira20011/AyurFlow/pull/33) merged. Role-to-account mapping not recorded. |
| A — TASK-UI-02 reviewer | Confirm the screen permissions match backend session/CSRF and record-access behavior; review errors and access states. | Team review and approval reported by B on 27 October 2026; PR #33 approved. Role-to-account mapping not recorded. |
| C — B clinical reviewer and scheduling owner | Confirm plan/session status wording and whether the clearance boundary is clear to therapists. | Team review and approval reported by B on 27 October 2026; role-to-account mapping not recorded. |
| Clinic clinician with B — DEC02/08 | Confirm patient/signing fields, pathway labels/checklists, completion and hold/cancel behavior before clinical UAT. | Pending |

The visual mockups deliberately use generic stage labels and synthetic records. The clinic has not approved the pathway, signing fields, addendum reason rule, or therapist observation scope. DEC02/08 remain gates for affected clinical implementation and UAT, not for completion of these wireframes. Clinical screens should not be connected to protected routes until A/B/C finish the assignment and session-clearance contracts.
