# Clinical interface

TASK-CON-03 provides the consultation editor at `/clinical`: patient-scoped history, versioned draft save, explicit sign confirmation, read-only signed original and ordered dated corrections. The page is clinician-role gated by the shared staff session UI. Backend role and patient-record checks remain authoritative.

The client API calls in `api.ts` follow B's proposed contract in `docs/api/member-b-contract.md`. The Go clinical HTTP routes are not registered while DEC02's production clinician-to-patient assignment source and protected access behavior are unresolved. A live patient lookup therefore reports unavailable until that integration is implemented and reviewed. Do not list these routes in OpenAPI as implemented yet.

`/clinical/preview` is available only in Next.js development mode. It uses synthetic consultation records and browser memory for its actions; it makes no clinical API or database writes. It is for screen review, not AT03 evidence. Signing fields, correction reason rules and record access still require clinic/team review. No real patient data belongs in the preview.
