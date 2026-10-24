# Pending decisions

All decisions below remain pending; the scaffold makes no clinic approval claim.

Member B's [DEC01–02 clinic review record](clinic-rules-review.md) lists the questions and evidence needed to close the first two decisions. It contains no clinic approval yet.

For `TASK-SET-02`, Member B has recorded a provisional synthetic-development contract in that review record. The current user directed the planning task to proceed without waiting for clinic signoff. DEC01 and DEC02 remain pending clinic/team decisions for their stated UAT/release gates; the provisional rules must not be represented as clinic-approved or used as real-data authorization.

| ID | Owner / gate | Resolution required |
| --- | --- | --- |
| DEC01 | Team, clinic, supervisor / week 1 | Clinic identity, organization letter, supervisor details, review dates |
| DEC02 | Clinic clinician, B / weeks 1-2 | Patient/consultation fields, identifier normalization, record access, pathway, stage/session completion checks |
| DEC03 | Clinic dispensary, D / before inventory UAT | Recipe examples, grams conversion, decimal scale, rounding, expiry inclusivity/missing expiry, discrepancy process |
| DEC04 | Clinic billing, E / before Sprint 3 acceptance | Tariffs, invoice/deposit timing, rounding, receipt fields, external correction process |
| DEC05 | Clinic and institution / before real-data pilot | Data authorization, retention, report/export permissions and responsibilities |
| DEC06 | Clinic, A / before handover | Host, funding, backup/key custody, monitoring, restore owner, support contact |
| DEC07 | A and team / Sprint 1 | Session expiry, login throttling, recovery, API action/error conventions |
| DEC08 | Team and clinic / before SRS approval | Resumption/cancellation, assigned therapist start, completion during hold, availability protection and concurrency semantics |

Provisional API prefix: `/api/v1`. Error envelope: `{"error":{"code":"not_found","message":"..."}}`. These technical starter choices require team review alongside DEC07. No session timeout, clinical pathway or stock decimal scale is silently approved here.

## DEC07 review packet

### AUTH-03 synthetic-development authorization (24 October 2026)

The user (Member A) explicitly approved the provisional access rules for this implementation: reception can register/search/read/edit demographics; clinical access requires a clinician plus explicit patient assignment; therapist access requires a session assignment; administrator alone has no clinical access. Missing assignment adapters deny access. No assignment-management permission, billing projection or generic audit/report/export permission is approved by this decision. See [the implemented review contract](api/auth-03-contract.md) and [authorization module instructions](../backend/internal/authorization/README.md). This is development authorization with synthetic data only, not clinic approval or closure of DEC02/05.

The user chose to **keep session expiry/throttling settings explicitly configured** rather than adopt draft defaults. DEC07 remains pending team/F review; the auth feature remains disabled unless every existing policy setting is supplied. No recovery policy or production timeout was silently selected.

Member A's [shared API and security contract draft](api/shared-contract.md) lists candidate session, throttling, recovery, CSRF, error and retry conventions with examples and a reviewer table. All DEC07 choices remain **pending** until A and the team record selected values, reviewer names and date here. No auth route or acceptance test may treat the candidate values as approved configuration.
