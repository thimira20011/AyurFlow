# Member B Living Heritage screen alignment

**Review:** 4 November 2026, Codex; Member B implementation, C feature reviewer and F shared UI reviewer. Reference: the seven full-size Figma frames supplied by Member B in this chat: 03 Patient registry, 04 Register patient, 05 Signed consultation, 14 Consultation draft, and 06/17/18 Care plan states. This is synthetic visual review, not clinic or AT sign-off.

**Scope:** TASK-PAT-03 (SRS PAT-01–02, AT02), TASK-CON-03 (SRS CON-01–03, AT03), and TASK-CLN-05 (SRS CLN-01–06, AT04–05). Existing backend record checks and the SRS/DEC02 implementation rules take precedence over the illustrative Figma fields and sample content.

| Frame | Implemented comparison |
| --- | --- |
| 03 Patient registry | Forest sidebar, paper canvas, top staff bar, search-first heading, result table and selected patient folio. [Synthetic 1220px capture](member-b-figma-patient-registry.png). |
| 04 Register patient | Patient form and guidance card use the supplied layout. The working form retains required DOB, gender, and phone-or-postal fields that the illustration omits. [Synthetic 1220px capture](member-b-figma-patient-register.png). |
| 14 Draft and 05 signed consultation | The note or signed original occupies the wider left card; guidance or history is on the right. The dated correction form opens from its header action, preserving the signed text. [Draft](member-b-figma-consultation-draft.png) and [signed](member-b-figma-consultation-signed.png) synthetic captures. |
| 06/17/18 Care plan | Ordered stage cards are on the left and the next decision, reason and history are on the right. Pending, approved and held states use the same shell; required checklist confirmation and reason controls stay visible because the service requires them. [1366px](member-b-figma-care-plan-1366.png) and [1024px](member-b-figma-care-plan-1024.png) synthetic captures. |

**Method:** Headless Edge rendered the local Next.js app at 1220×768, 1366×768 and 1024×768. The preview screens use labelled browser-memory synthetic records; the plan capture uses intercepted synthetic session and plan responses. Each capture had zero page-wide horizontal overflow. `npm run lint`, `npm test` (13/13) and `npm run build -- --webpack` passed locally. These screenshots prove layout only; the [real HTTPS/Go/PostgreSQL browser record](member-b-at02-at03-cln05-2026-11-04.md) covers the protected journeys before this visual revision. Re-run that suite on this branch before review.

**Practical differences:** The API currently opens a clinical patient by UUID, so the screen shows an ID field rather than an invented patient name. The actual stage checklist and reasoned hold/resume/cancel controls are retained. No sample clinician identity or mock date is presented as a real staff record. F's shared navigation and typography review and C's feature acceptance remain pending.
