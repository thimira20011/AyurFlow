# Pending decisions

All decisions below remain pending; the scaffold makes no clinic approval claim.

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
