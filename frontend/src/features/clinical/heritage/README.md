# Clinical feature components

UI support for TASK-CON-03/04 and CLN-01–06 (CON-01–03, CLN-01–06; AT03–05). Clinical owner B, clinical reviewer C; shared UI support F. This is a synthetic component deliverable, not backend integration or AT acceptance evidence.

The Figma connector returned `tool not available` for both session creation and design context. Layouts follow the supplied brief; colors reuse existing `--heritage-*` tokens. Exact Figma comparison remains outstanding.

- `care-plan.tsx`: controlled patient overview and treatment checklist.
- `stage-approval.tsx`: controlled progression, asynchronous decision callback, required change notes, pending/error states, and audit history without note bodies.
- `signed-consultation.tsx`: immutable document presentation, signature status supplied by the caller, text export and isolated document printing (choose Save as PDF in the browser).
- `types.ts` and `mock-data.ts`: typed contracts and synthetic fixtures.
- `workspace-preview.tsx`: client-side composition example; `/clinical/heritage-preview` is development-only.

Run `npm run dev` from `frontend`, then visit `/clinical/heritage-preview`. Checklist and decisions use browser memory. Approval does not start the next clinical stage. Request Changes records a demo decision and keeps the stage in review. The signature is explicitly unverified demo data.

For live use, compose the controlled components inside the existing authenticated clinical workspace. Connect callbacks to reviewed APIs that enforce record access, version conflicts, checklist prerequisites and transactional audit writes. Reload authoritative state after mutations. Signed document reads/exports require the existing backend record checks. Supply `verified` only from a trusted verification result. DEC02/05/08 and AT03–05 remain applicable integration/release gates.
