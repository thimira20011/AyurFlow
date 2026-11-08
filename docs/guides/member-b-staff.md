# Patient and clinical records — staff guide

**Owner:** Member B · **Task:** OPS-03 · **Audience:** reception and clinicians

This guide describes the current synthetic-development application. Use assigned staff credentials and only synthetic records in development or demonstrations. The user-supplied DEC02 specification guides implementation, but its signed clinic source and final acceptance remain pending. This guide is not authorization for real patient data.

## Before you begin

1. Open the clinic's configured HTTPS address and select **Sign in**. Enter the login identifier and password assigned by an administrator. There is no public sign-up.
2. From **Staff workspace**, open **Patient records** for registration and demographics. This requires the receptionist role. Open **Consultations** or **Care plans** only with the clinician role and an explicit patient-record assignment. An administrator account alone does not grant patient-demographic or clinical-note access.
3. If sign-in fails, check the credentials once and ask the administrator to verify the account and service setup. Do not share passwords or use another staff member's session.

The `/patients/preview` and `/clinical/preview` pages are development-only synthetic screen previews. Their changes stay in browser memory and are lost on refresh. They are not patient records or evidence that a clinical action was saved.

The **Reception desk** page and its **Register Walk-in Patient** dialog are also a labelled synthetic preview. **Open Full Registry Form** leads to the working patient registration screen. Do not treat **Register & Check In** in that preview as a saved patient record.

## Register and find a patient

1. In **Patient records**, search by name, display code, internal UUID, supplied NIC/passport, or phone before registering. A search returns at most 25 permitted results. When no NIC/passport is available, expand **Confirm identity without NIC or passport** and enter the full legal name, exact DOB and primary phone from the authorized handoff. If the record has neither phone nor identity document, use its residential postal code instead of phone. Name-only search is not identity confirmation. If no unique exact match is found, use the clinic's unresolved-record procedure instead of guessing.
2. Select **Register patient**. Enter the full name, date of birth, gender and either a Sri Lankan mobile phone in `+947XXXXXXXX` or local `07XXXXXXXX` form, or a residential postal code when no phone is recorded. Address and a supplied NIC/passport are optional. If you choose NIC or passport, enter its number too. Review the spelling and identity before selecting **Create patient record**.
3. After a success message, use the displayed `AYUR-PT-XXXXX` code to search. Expand **More demographic details** to obtain the internal UUID for an authorized clinical handoff. Do not create another record because a screen response is slow.
4. To correct demographics, open the patient, select **Edit demographics**, change the fields, then **Save changes**. The update is audited. If the record changed while you were editing, use **Reload record**, review the latest values, and enter the correction again.

If registration reports a possible duplicate identity, search for the existing patient and follow the clinic's duplicate-record procedure. Do not change an identity number merely to bypass the conflict. If registration or an update cannot be confirmed because the service is unavailable, search or reload before retrying; the previous request may have succeeded.

## Consultation drafts, signing, and corrections

An administrator grants a clinician access using the patient and clinician UUIDs in **Staff administration → Clinician assignments**. This action does not let the administrator read consultation text. The **Consultations** screen then uses protected clinical routes for the assigned clinician. The synthetic preview is only for screen review.

1. Obtain the internal patient ID through an authorized handoff. In **Consultations**, enter the ID and select **Open patient**. The history list shows status and dates; note text appears only in a permitted record detail.
2. Select **New draft**, enter the clinical note, and **Save draft**. A draft can exist before a care plan. Open a draft again to edit and save its current version.
3. When the text is ready, save any unsaved changes, select **Review and sign**, read the confirmation, and select **Confirm signature**. Signing records the clinician and time and freezes the original text. Do not sign until the contents are checked.
4. For a later correction, open the signed record and select **Add dated correction** at the top of the page. Enter a reason and the correction text, then select **Add dated correction** in the form. The correction appears separately with its author and time. The signed original remains read-only.

If the screen says the record changed, select **Reload record** and review the current version before another action. If a write could not be confirmed, reload before retrying so a correction is not submitted twice. If access is unavailable, ask the responsible administrator or clinician to review the assignment through the approved process; do not use another account or copy note text into an unprotected channel.

## Care-plan decisions

The protected **Care plans** screen is available at `/clinical/plans` to an assigned clinician. It records the current plan, its three ordered stages (Preparatory, Primary and Recovery), approvals, hold/resume decisions and history. The clinician's actions below are for synthetic development; the signed DEC02 source, C/D session and preparation integration, and AT04–05 acceptance remain open.

1. Enter the authorized patient's internal UUID and select **Open plans**. Select an existing plan, or expand **Create plan**, optionally enter a same-patient source consultation UUID, and select **Create plan**. A new plan starts in **Not started** draft state.
2. Select the plan and choose **Start preparatory stage**. To approve the current stage, review every displayed required check, select each checkbox, then choose **Record approval**. Preparatory approval requires a signed consultation. The screen shows the current status and recorded decisions; a booking or invoice payment does not establish clinical clearance.
3. **Advance stage** requests only the next stage. It currently returns a conflict when scheduling or preparation completion evidence is unavailable; the plan must remain in its prior state. Do not assume that an attempted advancement succeeded. Select the plan again to inspect its latest status.
4. To place an active plan on hold, enter a **Clinical reason**, choose **Hold**, read the confirmation and select **Confirm hold**. A hold prevents new session starts and advancement; it retains prior approvals and already delivered history. To resume a held plan, enter the clinical evaluation reason and select **Resume**.
5. To cancel, enter a **Clinical reason**, choose **Cancel plan**, read the confirmation and select **Confirm cancel**. Cancellation is terminal and must cancel future unstarted sessions while retaining delivered history. Until C's cancellation adapter is integrated, the API rejects the request without changing the plan. Select the plan again to confirm its actual status.

Only assigned clinicians can approve stages or change plan state. An assigned therapist cannot approve or prescribe. Current-stage clearance must be checked at **session start**, even when a booking exists, and never depends on invoice balance. Do not enter plan decisions directly in the database. If a decision fails or cannot be confirmed, reload the plan and follow the clinic's existing approved process; do not repeatedly submit the action.

## When something goes wrong

| Screen result | Staff action |
| --- | --- |
| Session ended or sign-in required | Sign in again with your own account, then reopen the record. |
| Access unavailable or record not found | Confirm the patient ID from the authorized handoff; ask for the approved role/record assignment review. Do not try another account. |
| Field validation error | Correct the highlighted field and review the whole record before saving. |
| Duplicate identity | Search for the existing patient and follow the duplicate-record procedure. |
| Record changed or signing conflict | Reload, compare the latest record, then decide whether your change is still needed. |
| Plan advancement or cancellation conflict | Select the plan again; missing session/preparation integration may have blocked the action. Check the current stage and status before another decision. |
| Service unavailable or outcome uncertain | Do not repeatedly submit. Search or reload to check whether the action committed, then report the issue to the service owner. |

Never put clinical note bodies, passwords, or session tokens into support tickets or ordinary logs. Give support the time, screen, patient **internal ID only if the approved channel permits it**, and the displayed error; use the clinic's approved incident channel for any patient-specific details.

## Review before staff handover

Another team member must walk through registration, search, demographic correction, consultation draft/sign/addendum, care-plan actions and failure recovery with synthetic data, then record reviewer, date, environment, version and corrections. Recheck this guide after C/D integration and DEC02/08 acceptance. The current guide does not close AT02–05 or pilot readiness.
