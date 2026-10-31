# Shared authorization (TASK-AUTH-03)

Owner A, reviewer F; IAM-01–05, PAT-01–02 integration, AT01/AT13 support. The user approved these **synthetic-development** rules on 24 October 2026. DEC02 clinic review and DEC07/F review remain open; no real-data permission is implied.

## Current policy

| Action | Required role | Record check |
| --- | --- | --- |
| Patient register/search | `receptionist` | Explicit demographics-wide role scope; search checks each returned record too |
| Patient read/edit | `receptionist` | Valid existing patient; edits limited to display name, phone and optional identity |
| Clinical read/write | `clinician` | Owning module must supply an explicit patient-assignment adapter |
| Session read/write | `therapist` | Owning module must supply an explicit session-assignment adapter |
| Unknown action, audit, report, export | None approved here | Denied; no generic read/export fallback |

Administrator alone grants none of these permissions. Multiple roles grant only their explicit permissions. Billing/dispensary roles do not receive full patient demographics through this interface; their owners must supply reviewed minimal projections and record policies before exposing routes. Clinicians currently receive no unrestricted demographic endpoint either.

`Authorizer.Require(ctx, tx, actor, action, target)` checks the active account and current database role, not session role snapshots. It holds shared account and role row locks through the caller's transaction so a concurrent disable or role deletion cannot commit ahead of that protected operation. Account/role administration must use a consistent staff-first lock order and revoke sessions on disable. Module owners must return authorization errors without committing business changes.

Clinical/session checks fail closed with no `RecordAccess` adapter. Owners implement `AuthorizeRecord` using real module assignments and the **same transaction**. Check the exact target, actor, action, account state, workflow status and permitted projection. Lock assignment/state rows when a write can race with revocation or a workflow transition. Do not pass a client-selected actor, trust an HTTP role, use a blanket `return nil`, or reuse patient-read permission for notes/reports/exports. No assignment table is invented by this package. Clinical/session HTTP routes remain unregistered.

`PatientPolicy` implements B's existing `patients.AccessPolicy`. Patient services call it inside every read/write transaction; successful create/update still uses B's transactional audit writer. Unknown editable fields deny access. No patient migration is changed.

## HTTP integration

AUTH-04 staff management uses its own transaction-scoped administrator check in `internal/administration`. It authorizes staff account/role scope only; it does not add an administrator bypass to any policy above. See the AUTH-04 staff contract for self-lockout protection and session revocation.

Every protected route group uses `transport.RequireSession`. It validates the `__Host-ayurflow_session` cookie, rejects duplicate cookies and cross-site fetches, requires exact configured `Origin` plus the session's `X-CSRF-Token` on every unsafe method, sets `Cache-Control: no-store`, and installs only the validated actor. `ActorID(c)` is the only transport identity source. Services must also enforce this package's role/record policy in their transaction.

`auth.Authenticate` and `AuthenticateCSRF` preserve the CSRF token. Bad CSRF does not refresh idle time. `GET /auth/session` remains the explicit CSRF rotation/bootstrap operation; obtain its latest token after session refresh. Coordinate bootstrap across tabs; this slice does not introduce a token grace window. Login and logout retain their existing secure cookie/origin behavior. Missing/expired/revoked/disabled sessions fail; infrastructure errors fail closed with generic responses.

The API wires the patient service only when auth is explicitly configured. Four implemented routes are described in [the AUTH-03 review contract](../../../docs/api/auth-03-contract.md). No signup, account-administration, billing, audit, clinical or report route is opened by this work. Screens and account operations are AUTH-04/PAT-03 work.

## Verification

Run ordinary Go tests, vet/build and `go test -tags=integration -count=1 ./...` with disposable `TEST_DATABASE_URL`; Linux CI adds `-race` and rejects skipped tests. The tests exercise real middleware, sessions, current-role checks, patient transactions, CSRF stability, expiry and failed-audit rollback. The clinical HTTP test uses a test-only assignment adapter/route to prove the boundary; it does not prove a production clinical module or clinic policy. Full AT01/AT13 remains open.
