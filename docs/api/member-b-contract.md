# Member B patient and clinical contract — TASK-SET-06 review draft

**Status:** proposed for A (shared API/migrations), C (scheduling and reviewer), and F (UI) review. This is a synthetic-development contract, not an implemented API, an approved clinic rule, or AT evidence. The implemented endpoints remain in [openapi.yaml](openapi.yaml). Owner of this contribution: B; TASK-SET-06 coordinator: A; B feature reviewer: C.

**Requirements and proof:** PAT-01–02 / AT02; CON-01–03 / AT03; CLN-01–06 / AT04–05; SCH-04–06 / AT06–07 for the session join; AT01/13 for access and audit. TASK-PAT-01–03, CON-01–04 and CLN-01–06 implement these slices later. DEC02 (fields, access, pathway), DEC07 (shared wire/auth policy), and DEC08 (session transitions) remain open; see [clinic-rules-review.md](../clinic-rules-review.md) and [decisions.md](../decisions.md). An unresolved choice below must be reviewed before its affected endpoint or acceptance case is released.

## Shared ID and relationship proposal

Use server-generated UUIDs for stored records and UTC `timestamptz` for instants. Return lower-camel-case JSON IDs. Keep clinical note bodies out of audit events, logs, list summaries, and non-clinical responses. Do not hard-delete patients, signed notes, decisions, or referenced history. Proposed relational boundaries:

| Record | Key and links | Invariants / review need |
| --- | --- | --- |
| `patients` | `id` UUID PK; `display_name`; optional contact fields; created/updated actor and UTC time | Name is nonblank Unicode. Contact fields, allowed edits and lengths need DEC02. Search needs a stable `(display_name, id)` or equivalent indexed ordering. |
| `patient_identities` | `id` UUID PK; `patient_id` FK; `identity_type`, `original_value`, `canonical_value` | A supplied identity has nonempty canonical text and a unique `(identity_type, canonical_value)` constraint. Missing identity creates no row. One or several identities per patient needs DEC02; start with at most one for synthetic work. Preserve the supplied value. Do not merge NIC and passport namespaces. |
| `patient_clinician_assignments` | `patient_id` FK, `clinician_id` FK to `staff_accounts`; grant/revoke actor and time | Candidate record-access mechanism: only an active assigned clinician can access another clinician's patient record. Assignment authority and historical access need DEC02/A review. Until this is enforced, clinical routes stay unregistered. |
| `consultations` | `id` UUID PK; `patient_id` FK; author clinician FK; draft/signed state; version; draft text; signed actor/time | A consultation can exist without a plan. Signing freezes the original text. Store no signed-note overwrite path. Version guards edit/sign races. Required clinical fields need DEC02. |
| `consultation_addenda` | `id` UUID PK; `consultation_id` FK; author, UTC time, reason and body | Insert-only after signing; no update/delete route. Reason rule needs DEC02. |
| `care_plans` | `id` UUID PK; `patient_id` FK; optional source consultation FK; active/held/cancelled/completed state; current stage ordinal; version; created clinician/time | One ordered pathway per plan. Whether another plan may follow a completed/cancelled plan requires review. A consultation never requires a plan. Keep plan status separate from stage status. |
| `plan_stages` | `id` UUID PK; `plan_id` FK; ordinal, label snapshot, status, approval actor/time and completion actor/time | Unique `(plan_id, ordinal)`; advance by one stage only. Stage names and checklists remain DEC02. Historical labels/decisions persist if the pathway definition changes. |
| `plan_decisions` | `id` UUID PK; `plan_id` FK; optional `stage_id` FK; action, actor, UTC time, reason, from/to state | Insert-only decision history for approval, advancement, hold, resume and cancellation. Store no note body. Actions and required reason rules need DEC02/08. |
| C-owned `sessions` | `patient_id`, `plan_id`, `stage_id`, assigned therapist, interval and lifecycle state | B and C must require the stage to belong to the plan and the plan to the patient. Booking is not start clearance. C owns this table and migration; B does not edit it. |

The provisional synthetic identity canonicalization in `clinic-rules-review.md` trims outer whitespace, removes ASCII spaces/hyphens, and uppercases ASCII letters. Validation must reject an empty result. The exact function and identity types require DEC02 before AT02; whichever function is approved must be applied consistently for writes and lookups, with a PostgreSQL uniqueness constraint as the final race guard. A duplicate registration returns a generic 409 without the other patient's ID or name.

## Proposed API surface, not registered

Every path is under `/api/v1`. A authenticates sessions and supplies CSRF for unsafe methods. Each handler validates shape; its service enforces role **and record** access before repository work. Inaccessible records return 404 when existence must be hidden; a known forbidden action can return 403. Use the shared 400/401/403/404/409/422 error envelope and bounded `items`/`nextCursor` lists from [shared-contract.md](shared-contract.md). No path below belongs in `openapi.yaml` until implemented and reviewed.

| Proposed method/path | Input and result | Minimum backend access / conflict rule |
| --- | --- | --- |
| `POST /patients` | `displayName`, optional `identity: {type, value}`, agreed optional contacts → server `id` and permitted demographics | Authorised registration role; normalize identity in transaction; unique conflict 409. Audit create atomically. |
| `GET /patients?query=&limit=&cursor=` | Bounded permitted demographic summaries, stable sort and opaque cursor | Authorized search role; filter by record permission **before** pagination. Never include notes. Query by ID, name, supplied identity and approved contacts. |
| `GET /patients/{patientId}` | Permitted demographic detail | Role and patient-record check; hide inaccessible patient with 404. |
| `PATCH /patients/{patientId}` | Allowed demographic fields plus `version` → updated detail/version | Field-level role/record rule; stale version 409; normalize changed identity and audit in same transaction. |
| `POST /patients/{patientId}/consultations` | Draft clinical fields → consultation ID/version | Active clinician with patient access; no plan required; audit creation. |
| `GET /patients/{patientId}/consultations` and `GET /consultations/{id}` | Bounded history and authorized draft/signed detail | Active clinician with patient access; no body in list for non-clinical roles. |
| `PATCH /consultations/{id}` | Draft fields and `version` → new version | Authorized clinician; draft only; stale/signed conflict 409. |
| `POST /consultations/{id}/sign` | `version` and required signing fields → signer/time and immutable original | Authorized clinician; row/version lock; competing edit/sign returns 409; critical audit shares transaction. |
| `POST /consultations/{id}/addenda` | `reason`, `body` → separate dated addendum | Authorized clinician; signed consultation only; append and audit in one transaction. |
| `POST /patients/{patientId}/plans` | Ordered stage proposal and source consultation ID if used → plan ID/version | Authorized clinician; validate same patient; provisional stage labels only for synthetic work. |
| `GET /patients/{patientId}/plans` and `GET /plans/{id}` | Bounded plan summaries or authorized timeline/decisions | Clinical record access; therapist receives only C's minimum session clearance projection. |
| `POST /plans/{id}/stages/{stageId}/approve` | `version`, approved decision/checklist → actor/time | Authorized clinician; current stage only; no prior-stage skip; 409 on stale/invalid state. |
| `POST /plans/{id}/advance` | `version`, completion evidence → next current stage/version | Authorized clinician; current stage approved and completion rules satisfied; one-stage transition only. |
| `POST /plans/{id}/hold`, `/resume`, `/cancel` | `version`, reason → decision and new status | Authorized clinician; reasoned state transition; cancel terminal; 409 on stale/invalid state. Coordinate C's future unstarted sessions. |

All mutations are protected by CSRF. Create/action responses should return only the resource fields the caller may read. Do not expose raw SQL errors or another patient's identifiers. DEC07 must confirm final action naming, error codes, list conventions and session policy; F reviews field error and timeline shapes.

### Proposed field and response examples

These payloads fix names for review, not clinic-approved field requirements. Omitted optional values are absent or `null`; the API must not interpret omission as a request to erase existing demographics. `version` is an integer concurrency token returned on editable records and required for edits and state transitions. A/C/F must review that convention with DEC07.

```json
{
  "displayName": "Synthetic Patient",
  "identity": {"type": "NIC", "value": "1999 12345678 V"},
  "phone": null
}
```

The provisional registration response is `201` with `{"id":"<server-uuid>","displayName":"Synthetic Patient","identity":{"type":"NIC","value":"1999 12345678 V"},"phone":null,"version":1,"createdAt":"<UTC-RFC3339>"}`. Never return `canonical_value` as a patient-facing identity. An absent identity is represented as `null`; a blank supplied identity is 422. A repeated canonical type/value is 409 even under simultaneous requests. Name is nonblank after trimming; preserve its Unicode content. Phone format, maximum length and whether it is stored at all remain DEC02.

```json
{
  "patientId": "<patient-uuid>",
  "draftText": "Synthetic consultation note"
}
```

The consultation create response is `201` with `id`, `patientId`, `status: "draft"`, `version: 1`, `authorId`, and UTC `createdAt`. The clinical detail read may include `draftText` or the frozen `signedText`, `signedBy`, `signedAt`, and a dated `addenda` array for an authorized clinician. Non-clinical roles get no consultation detail projection. DEC02 decides structured observations and fields required at signing.

```json
{
  "patientId": "<patient-uuid>",
  "sourceConsultationId": "<optional-consultation-uuid>",
  "stages": [
    {"ordinal": 1, "label": "Preparatory"},
    {"ordinal": 2, "label": "Primary"},
    {"ordinal": 3, "label": "Recovery"}
  ]
}
```

The stage labels above are synthetic examples only. Plan creation returns the server IDs, `status: "active"`, `currentStageId`, `version`, and a stage timeline with approval and completion metadata. Validate consecutive ordinals starting at 1, no duplicate stage, same-patient source consultation, and a nonempty ordered pathway. The approved pathway and whether staff may supply stages versus selecting a clinic-configured template remain DEC02. Stage approval, advancement, hold, resume and cancellation return the updated plan/version plus the new decision's actor and UTC time; the server derives actor/time from the authenticated session, never from client JSON.

### Role and record review matrix

| Actor | Proposed patient demographics | Consultation/plan detail | Clinical decision and session start |
| --- | --- | --- | --- |
| Receptionist | Register/search/read; demographic edit only for DEC02-approved fields | No clinical text or plan decision detail | No |
| Active assigned clinician | Read permitted patient record; edit demographics only under agreed field policy | Create/read/edit own or assigned drafts; sign/add addenda; read assigned plan | Approve/advance/hold/resume/cancel assigned plan; no therapist start grant |
| Assigned therapist | Minimum patient and session identifiers through C's session projection | No full note body or prescribing/approval action | C may start only the assigned session after B clearance |
| Dispensary/billing staff | Minimum identifiers needed by their own module | No full note body or clinical decision action | No |
| Administrator alone | Account administration only unless separately assigned an authorized clinical role and record access | No clinical text by administrator role alone | No clinical decision by administrator role alone |

The assignment source, permitted demographic fields and therapist observation scope remain DEC02. Deny clinical access by default while those rules are unresolved. Permissions apply to every direct read, write, search and export; UI visibility is only a usability aid.

## B/C session-clearance contract

At **start**, C supplies `sessionId`, `patientId`, `planId`, `stageId`, and assigned therapist identity to a B-owned clearance function within one PostgreSQL transaction. B checks that the active plan belongs to that patient, the stage belongs to that plan, it is the current approved stage, and the plan is neither held nor cancelled nor complete. C separately checks assignment, session state, availability and booking constraints. A booking alone never grants clearance; invoice balance is irrelevant. Return a typed allow/deny result without clinical text. C owns the start endpoint and session mutation; B owns plan/stage decisions and the clearance rule.

**Proposed lock order for B/C review:** lock `care_plans` first, then the relevant `plan_stages`, then C's `sessions`, and finally other affected future session rows in stable ID order. Hold/cancel and start must use the same order so they serialize. If hold commits first, start fails without changing the session. If start commits first, hold may follow; the started session may complete during hold under the provisional DEC08 rule. Cancellation retains completed and consumption history while cancelling future unstarted sessions. Failed audit insertion rolls back the decision/start transaction. C must review the exact locking and cancellation ownership before implementation; PostgreSQL race tests prove the final contract under AT04–07.

## Migration and review handoff

- A allocates forward-only migration numbers after the current `000004_billing.up.sql`; B owns patient/consultation/plan migrations, C owns session schema. Do not edit an applied migration or another module's schema.
- `000004_billing.up.sql` currently stores `invoices.patient_id` without a foreign key. E and A must plan a **new E-owned follow-up migration** after B's patient table exists to enforce that reference; B must not change the billing migration.
- B will implement patient identity uniqueness and same-patient plan/consultation references with database constraints. B/C must agree cross-module session references and lock order before protected routes are registered.
- A reviews IDs, assignment enforcement, shared errors, CSRF and migration order. C reviews plan/stage/session linkage and start/hold/cancel races. F reviews field names, list states, and permitted screen projections. Record reviewer, date, outcome and evidence before calling TASK-SET-06 complete.

| Reviewer / handoff | Status | Outcome/date/evidence |
| --- | --- | --- |
| A — shared API, auth/record permissions, migration sequence | Pending | — |
| C — patient/clinical reviewer and session join | Pending | — |
| F — UI contract and list/action/error shapes | Pending | — |
| Clinic clinician — DEC02 fields, access, pathway examples | Pending | — |
| Team/clinic — DEC08 concurrency and delivery rules | Pending | — |

**Acceptance cases to preserve:** optional identity and duplicate registration race, Unicode search, direct forbidden reads, consultation draft without plan, sign/edit race and immutable addenda, unauthorized/stale approval, no stage skip, noncurrent-stage start rejection, held/cancelled start rejection, and hold/cancel versus start races. These are test designs, not passed AT results; [testing.md](../testing.md) records execution evidence when implemented.
