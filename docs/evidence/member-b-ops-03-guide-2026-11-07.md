# OPS-03 Member B guide verification

**Owner / scope:** Member B's patient and clinical staff guide, covering PAT-01–03, CON-01–03 and CLN-01–05. F assembles OPS-03; another team member must perform the independent walkthrough before staff handover.

**Author check:** 7 November 2026 (Asia/Colombo), Codex on `member-b/ops-03-guide-verification` from `dev` commit `d8ee17e`. The guide was compared with the current patient, consultation, care-plan and reception screen labels, their protected API behavior, and the [real synthetic browser/PostgreSQL record](member-b-at02-at03-cln05-2026-11-04.md). No real patient data or credentials were used.

| Guide step checked | Expected / observed source behavior | Guide correction |
| --- | --- | --- |
| Reception desk intake versus patient registry | Reception's walk-in dialog writes to its synthetic in-memory list; **Open Full Registry Form** links to `/patients?action=register`. The protected registry submits through the patient API. | Direct staff to the full registry for saved records. |
| Register and confirm identity | The live form submits with **Create patient record**. Exact no-ID confirmation accepts name + DOB + phone, or postal code only when the record lacks phone and supplied ID. | Use the actual button label and document the postal fallback. |
| Consultation and addendum | An assigned clinician saves a draft, confirms signing, and opens the correction form from the signed record header. The original remains read-only. | Clarify the two **Add dated correction** controls. |
| Care-plan decisions | Assigned clinicians can create/start plans, confirm current-stage checks, approve, hold and resume. Advancement and cancellation fail with 409 while C/D completion and C cancellation adapters are absent; the prior state is retained. | Replace the obsolete statement that all plan actions are unavailable with the current guarded procedure. |

**Execution boundary:** Local real PostgreSQL/browser execution was not repeated: `AUTH_E2E_DATABASE_URL` is unset and Docker Desktop's Linux engine pipe was unavailable. The linked 4 November CI run already exercised protected synthetic registration, consultation and guarded plan actions against PostgreSQL. This author check verifies wording against the current implementation; it is not an independent staff walkthrough or AT02–05 acceptance.

**Independent verifier handoff:** In a configured synthetic HTTPS environment, have another member follow the updated guide from role-specific sign-in through patient registration/search/edit, clinician assignment, draft/sign/addendum, plan create/start/approval/hold/resume, and a rejected advancement/cancellation. Record their name, date, commit, environment, expected/actual results and any corrections here before closing B's OPS-03 handoff.
