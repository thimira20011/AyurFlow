# Clinical interface

TASK-CON-03 provides the consultation editor at `/clinical`: patient-scoped history, versioned draft save, explicit sign confirmation, read-only signed original and ordered dated corrections. The page is clinician-role gated by the shared staff session UI. Backend role and patient-record checks remain authoritative.

The client API calls in `api.ts` follow B's contract in `docs/api/member-b-contract.md`. With authentication explicitly configured, the Go API registers protected consultation routes and enforces active clinician role plus patient assignment. Administrators grant or revoke assignments at `/administration/clinical-assignments`; their role alone never grants clinical-note access. The signed clinic source and integrated AT03 journey remain review gates. Do not publish these routes in OpenAPI until endpoint review is recorded.

`/clinical/preview` is available only in Next.js development mode. It uses synthetic consultation records and browser memory for its actions; it makes no clinical API or database writes. It is for screen review, not AT03 evidence. Signing fields, correction reason rules and record access still require clinic/team review. No real patient data belongs in the preview.
