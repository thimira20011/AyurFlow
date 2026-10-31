# Member B synthetic acceptance examples — TASK-QA-01 contribution

**Status:** proposed cases and fixture data, not executed AT evidence. TASK-QA-01 is coordinated by F and reviewed by A; B supplies PAT/CON/CLN examples and C reviews B's feature behavior. Source: SRS v1.0 PAT-01–02, CON-01–03, CLN-01–06 and AT02–05, plus the B/C join in AT06–07. [Fixture values](../../tests/fixtures/member-b-cases.json) are synthetic. DEC02 and DEC08 must replace provisional clinical details before clinic UAT. Record actual setup, tester, date, version, environment and evidence in [testing.md](../testing.md) when these tests run.

## Patient cases — AT02

| Case | Setup and steps | Expected result | Gate / owner |
| --- | --- | --- | --- |
| B-PAT-01 | As an authorized receptionist, register `b-no-identity`. Repeat with a second synthetic patient without identity. | Both receive distinct server IDs; optional identity is not required. Registration audit event exists with no note text. | DEC02 fields; B |
| B-PAT-02 | Two authorized staff concurrently register `b-nic-first` and `b-nic-equivalent-conflict` against a clean disposable PostgreSQL database. | Exactly one committed patient/identity; the other gets a generic 409 with no existing patient ID/name. The failed request leaves no orphan patient or audit event. | DEC02 normalization; B, real PostgreSQL |
| B-PAT-03 | Register `b-passport-distinct` after a NIC with the same canonical characters. | Passport and NIC remain distinct identity namespaces under the provisional rule. | DEC02 identity types; B |
| B-PAT-04 | Register `b-unicode`; search by full and agreed partial Unicode name and retrieve it. | Unicode name round-trips without replacement; results are bounded, stable and restricted to permitted records. | DEC02 search policy; B |
| B-PAT-05 | Attempt direct GET/PATCH by an unauthenticated caller, unrelated role, and a role with no record access. | 401/403 or privacy-preserving 404 as appropriate; no patient details leak. | A auth/record checks; B |
| B-PAT-06 | Update permitted demographics as an authorized user; submit a simultaneous stale version and a conflicting normalized identity. | One valid update commits with its critical audit event; stale/conflicting writes fail without changing the previous committed record. | DEC02 editable fields; B, real PostgreSQL |

## Consultation cases — AT03

| Case | Setup and steps | Expected result | Gate / owner |
| --- | --- | --- | --- |
| B-CON-01 | An assigned clinician creates a draft for `b-no-identity` without a care plan. | Draft is saved and readable by authorized clinicians; a plan is not required. | DEC02 draft fields; B |
| B-CON-02 | An assigned clinician edits while another request signs the same draft version. | Exactly one coherent state wins; a signed original is never overwritten by a stale edit or second signature. Conflict returns 409 and leaves prior committed state intact. | DEC02 signing fields; B, real PostgreSQL |
| B-CON-03 | Add a dated, reasoned correction to a signed consultation, then read history. | Original signed text, signer/time and all ordered addenda remain unchanged; addendum has its own author/time/reason and audit event. | DEC02 addendum rule; B |
| B-CON-04 | A receptionist, admin-only account and unassigned clinician request note detail by direct API call. | Full text is denied even if a UI link is guessed; audit/logs do not contain note bodies. | DEC02 record assignments; A/B |

## Clinical and B/C scheduling cases — AT04–05, AT06–07 join

| Case | Setup and steps | Expected result | Gate / owner |
| --- | --- | --- | --- |
| B-CLN-01 | Create the provisional three-stage plan; attempt to approve or advance Recovery before Preparatory is completed. | Stage skip is rejected, with unchanged current stage and retained history. | DEC02 pathway/checklist; B |
| B-CLN-02 | An unauthorized therapist or admin-only account attempts stage approval. | Backend rejects the action; no approval or audit-success record is committed. | DEC02/A access; B |
| B-CLN-03 | Book a future-stage session and attempt start before its stage is current and approved. | Booking does not grant clearance; start is rejected even if invoice is paid. | DEC02/08; B/C |
| B-CLN-04 | Race clinician hold against assigned therapist start, using independent database transactions. | If hold commits first, start fails; if start commits first, hold may follow. No start bypasses an effective hold. An already started session may complete during hold under provisional DEC08. | DEC08 and lock order; B/C, real PostgreSQL |
| B-CLN-05 | Cancel a plan with one completed, one started and one future unstarted session. | Cancellation is terminal; future unstarted sessions are cancelled, completed history and consumption are retained. In-progress handling follows the approved DEC08 rule. | DEC08; B/C |
| B-CLN-06 | Resume a held plan and attempt to advance without the required current-stage completion. | Resume preserves approvals but does not skip the completion/advancement guards. | DEC02/08; B |
| B-CLN-07 | Force critical audit insertion to fail during approval, hold or cancellation. | The entire mutation rolls back; previous plan and session state stays committed. | A audit mechanism; B/C, real PostgreSQL |

## Journey handoff to F

Use `b-no-identity` for the synthetic patient-to-receipt walkthrough: authorized login → registration/search → consultation draft/sign/addendum → approved current stage → C's conflict-safe booking and assigned therapist start → D's preparation/actual consumption → E's issued invoice/direct receipt. B supplies patient and clinical assertions above; F owns the cross-module run, evidence record, viewport checks and performance setup. No example here establishes clinic approval or a passed AT result.
