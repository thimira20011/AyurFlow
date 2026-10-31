# AUTH-04 staff administration — implemented review packet

26 October 2026. Owner A, reviewer F; IAM-01–05, ADM-01 account-management support, partial AT01/AT13. Branch `codex/auth-04-staff` is based on `codex/auth-04-login` (`a6907b9`), from `dev` at `598c625`. Review/merge login first.

## Provisional policy approved by the user

Administrators choose an initial password with at least 15 Unicode characters and explicit, nonempty, distinct catalog roles. The existing hasher's 1024 UTF-8 byte ceiling is retained; Unicode passwords may reach it sooner than 1024 characters. Login identifiers are trimmed/lowercased, nonblank, valid UTF-8, at most 64 bytes and contain no control characters. No public signup, automatic password, recovery, forced password change, reactivation or reset endpoint is added. Bootstrap uses the existing explicit synthetic seed. DEC07 and clinic/real-data approval remain open.

## Implemented contract

Under `/api/v1`, only with explicit auth configuration. Every route validates the cookie session; mutations require exact Origin and session CSRF. Each service operation checks the current active administrator in its transaction. Scope is staff accounts only, never clinical text.

| Method/path | Input | Success |
| --- | --- | --- |
| `GET /admin/staff?after=<UUID>` | Optional UUID cursor | 200 `{items,roles,nextCursor?}`, up to 25 accounts and role catalog |
| `POST /admin/staff` | `{loginIdentifier,password,roles:[codes]}` | 201 staff projection |
| `PUT /admin/staff/{id}/roles` | `{roles:[codes]}` | 200 staff; changed roles revoke that account's sessions |
| `POST /admin/staff/{id}/disable` | No body | 204; atomic disable/revocation, harmless repeat |

Staff fields: `id`, `loginIdentifier`, `active`, `roles`, `createdAt`. No passwords, hashes or session secrets are returned or audited. Strict JSON bodies are limited to 16 KiB; malformed/unknown/trailing JSON returns 400. Invalid fields return 422, forbidden staff actions 403, absent targets 404, duplicates/self-lockout/inactive-role changes 409 and infrastructure failures generic 503. Session/CSRF errors retain 401/403 behavior. The published OpenAPI remains limited to reviewed endpoints; this packet supplies the concrete implemented contract for F review.

## Transactions and races

Writes take advisory transaction lock `5109008` before account/role locks. This serializes privilege changes and the low-volume creation hash work. Actor permission is rechecked, the target is locked, and the business change plus `staff.created`, `staff.roles_changed` or `staff.disabled` audit event commit together. Audit metadata contains actor/object/time/changed field names, never password contents or a role payload. Audit failure rolls back session revocation too. Staff response retrieval is inside the transaction before commit. No schema or applied migration changes are needed.

Self-disable and self-removal of administrator access are rejected after UUID canonicalization, including uppercase/dashless spellings. Two administrators cannot concurrently demote/disable each other and lose the final active administrator: after one change, the second actor fails the current-role/active check. Unchanged roles and repeated disabling make no extra mutation/audit.

Session lookup uses a materialized account-lock CTE before its session lock, matching disable's order. Login rechecks and locks the active account after password work and before issuing a session. Existing fresh expiry/CSRF behavior is retained. The UI warns that changing roles ends sessions and uses focused errors, password-manager support and POST forms. Clients never automatically retry uncertain writes; inspect the current list before retrying. Other tabs/B's patient bootstrap can rotate CSRF; refresh and retry deliberately on rejection.

## Verification and limits

Real PostgreSQL tests cover hashed creation, permission denial, invalid roles, self-check spellings, duplicate login, disabled login, revocation, complete audit rollback and competing administrators. HTTP tests use real middleware and service code for CSRF/role enforcement and deterministic account/session lock-order proof. Local tests/vet/static analysis/build/tagged compilation and frontend lint/typecheck/seven helper tests/build passed.

**Recorded result, 26 October 2026:** Codex automation verified implementation `ccbeb22` using [staff workflow 40227744450](https://github.com/thimira20011/AyurFlow/actions/runs/40227744450). All four jobs passed on Linux, including 81 PostgreSQL integration cases with race detection and no skipped tests. Setup used the workflow's isolated synthetic database and repository migrations; expected results were permission/CSRF denial, atomic audit rollback, revoked-session rejection and completion without lock-order deadlock. The integration logs record those tests passing; workflow artifacts retain test output. The dependent [login workflow 40226412067](https://github.com/thimira20011/AyurFlow/actions/runs/40226412067) also passed all four jobs at `a6907b9`.

Browser smoke/UAT was not completed locally. F review, DEC07 and full AT01/AT13 remain pending; helper/build and database regression success alone are not acceptance.
