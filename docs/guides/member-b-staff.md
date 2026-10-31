# Patient and clinical records — staff guide

**Owner:** Member B · **Task:** OPS-03 · **Audience:** reception and clinicians

This guide describes the current synthetic-development application. Use assigned staff credentials and only synthetic records in development or demonstrations. Clinic decisions on fields, record assignment, signing, and the care pathway remain pending (DEC02). This guide is not authorization for real patient data.

## Before you begin

1. Open the clinic's configured HTTPS address and select **Sign in**. Enter the login identifier and password assigned by an administrator. There is no public sign-up.
2. Open **Patient records** for registration and demographics. This requires reception access. Open **Consultations** only with a clinician account and an explicit patient-record assignment. An administrator account alone does not grant clinical-note access.
3. If sign-in fails, check the credentials once and ask the administrator to verify the account and service setup. Do not share passwords or use another staff member's session.

The `/patients/preview` and `/clinical/preview` pages are development-only synthetic screen previews. Their changes stay in browser memory and are lost on refresh. They are not patient records or evidence that a clinical action was saved.

## Register and find a patient

1. In **Patient records**, search by name, internal patient ID, supplied NIC/passport, or phone before registering. A search returns at most 25 permitted results. If several are plausible, inspect the permitted demographic detail before choosing one.
2. Select **Register patient**. Enter the patient's name. Phone and one supplied identity are optional under the current development rules. If you choose NIC or passport, enter its number too. Review the spelling and identity before selecting **Register patient**.
3. After a success message, use the displayed patient record and internal ID for the next authorized handoff. Do not create another record because a screen response is slow.
4. To correct demographics, open the patient, select **Edit demographics**, change the fields, then **Save changes**. The update is audited. If the record changed while you were editing, use **Reload record**, review the latest values, and enter the correction again.

If registration reports a possible duplicate identity, search for the existing patient and follow the clinic's duplicate-record procedure. Do not change an identity number merely to bypass the conflict. If registration or an update cannot be confirmed because the service is unavailable, search or reload before retrying; the previous request may have succeeded.

## Consultation drafts, signing, and corrections

The **Consultations** screen is present, but live clinical routes are not registered in the running API while assignment-management authority is awaiting DEC02 review. The steps below describe the implemented screen and protected service behavior for staff review; use the synthetic preview to inspect the interface until the live route and assignment process are approved.

1. Obtain the internal patient ID through an authorized handoff. In **Consultations**, enter the ID and select **Open patient**. The history list shows status and dates; note text appears only in a permitted record detail.
2. Select **New draft**, enter the clinical note, and **Save draft**. A draft can exist before a care plan. Open a draft again to edit and save its current version.
3. When the text is ready, save any unsaved changes, select **Review and sign**, read the confirmation, and select **Confirm signature**. Signing records the clinician and time and freezes the original text. Do not sign until the contents are checked.
4. For a later correction, open the signed record, enter a reason and the correction text, then select **Add dated correction**. The correction appears separately with its author and time. The signed original remains read-only.

If the screen says the record changed, select **Reload record** and review the current version before another action. If a write could not be confirmed, reload before retrying so a correction is not submitted twice. If access is unavailable, ask the responsible administrator or clinician to review the assignment through the approved process; do not use another account or copy note text into an unprotected channel.

## Care-plan decisions

Care-plan creation, approval, advancement, hold, resume, cancel and session clearance are **not yet available as staff actions**. CLN-01 provides a proposed database structure only. Do not interpret a booking, a preview screen, or an invoice payment as clinical clearance. Until DEC02 fixes the pathway labels and completion checklist and DEC08 fixes the hold/start rules, follow the clinic's existing approved process outside this development app. Do not enter a plan decision directly in the database.

When the care-plan workflow is released, this section must be verified against its actual screen and clinic procedure before staff use. The intended controls are: a named authorized clinician records approval for the current stage; advancement proceeds one stage at a time after required completion evidence; a hold blocks new session starts and advancement; cancellation preserves completed history and prevents future starts. An assigned therapist cannot approve a plan. The application must check current-stage clearance at **session start**, even when a booking exists.

## When something goes wrong

| Screen result | Staff action |
| --- | --- |
| Session ended or sign-in required | Sign in again with your own account, then reopen the record. |
| Access unavailable or record not found | Confirm the patient ID from the authorized handoff; ask for the approved role/record assignment review. Do not try another account. |
| Field validation error | Correct the highlighted field and review the whole record before saving. |
| Duplicate identity | Search for the existing patient and follow the duplicate-record procedure. |
| Record changed or signing conflict | Reload, compare the latest record, then decide whether your change is still needed. |
| Service unavailable or outcome uncertain | Do not repeatedly submit. Search or reload to check whether the action committed, then report the issue to the service owner. |

Never put clinical note bodies, passwords, or session tokens into support tickets or ordinary logs. Give support the time, screen, patient **internal ID only if the approved channel permits it**, and the displayed error; use the clinic's approved incident channel for any patient-specific details.

## Review before staff handover

Another team member must walk through registration, search, demographic correction, consultation draft/sign/addendum, and failure recovery with synthetic data, then record reviewer, date, environment, version and corrections. Recheck this guide after clinical routes, care-plan actions and DEC02/08 are approved. The current guide does not close AT02–05 or pilot readiness.
