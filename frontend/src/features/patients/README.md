# Patients interface

TASK-PAT-03 (B; C reviews) supplies the patient registry interface at `src/app/patients/page.tsx`. It uses the implemented synthetic-development contract in `docs/api/auth-03-contract.md`: session check, bounded search, registration, permitted demographic detail and versioned updates. `api.ts` requests a current CSRF token immediately before each mutation. The Go API remains the authority for role, record and field rules.

The screen is for reception staff. Its primary action is finding an existing record; the right-hand folio shows permitted demographics or the registration form. Patient names remain Unicode, timestamps display in Asia/Colombo, and the UI has empty, loading, conflict, validation, denied and unavailable states. Its restrained green and ruled layout uses the existing project palette; feature-local styles avoid changing F's shared design system. There are no sample or real patient records in the UI.

In `next dev` only, `/patients/preview` renders this screen with two labelled synthetic records in browser memory. Search, registration and demographic edits can be explored without a session; preview actions never call the patient API or persist data. The preview route returns 404 outside development and does not prove the protected flow.

Status: PAT-03 is in progress. A's AUTH-03 routes are available only with explicit auth configuration and HTTPS, while the shared sign-in screen remains a placeholder. F's shared UI tasks and DEC02/07 review are open. C review and the integrated login → registration → search journey are required before AT02/PAT-03 completion.
