# AUTH-03 implemented development contract — review pending

Owner A; reviewer F, with B/C review of the patient handoff. SRS IAM-01–05, PAT-01–02, AT01/AT13 support. User approved the provisional access rules for synthetic development on 24 October 2026 and chose to keep session/throttling settings explicitly configured. DEC02/07 and clinic acceptance remain open.

These endpoints are implemented when `AUTH_ENABLED=true` and all existing auth configuration values are explicitly supplied. `AUTH_ENABLED` unset leaves them unregistered. Auth requires an HTTPS frontend origin; development must use the existing HTTPS proxy/template or equivalent setup. Plain HTTP browsers cannot send the Secure cookie. There is no authentication or timeout default added here.

## Protected patient endpoints

All require the session cookie and a current active `receptionist` role. Other roles, including administrator-only accounts, do not gain access. Reads/edits check the target inside the service transaction. Clinical text is never included. Responses use `Cache-Control: no-store`.

| Method/path (under `/api/v1`) | Input | Success |
| --- | --- | --- |
| `POST /patients` | `displayName`, optional `phone`, optional `identity: {type, value}` | 201 patient object |
| `GET /patients?q=...` | Nonblank query, at most 128 bytes; existing ID/name/identity/phone matching | 200 `{items: [...]}`, at most 25 authorized patients; no cursor or hidden total |
| `GET /patients/{id}` | Patient UUID | 200 patient object |
| `PATCH /patients/{id}` | Required current `version`; one or more of `displayName`, `phone`, `identity` | 200 updated patient, incremented version |

Patient objects contain `id`, `displayName`, nullable `phone`/`identity`, `version`, `createdAt`, `updatedAt`. Identity uses the provisional `NIC`/`PASSPORT` contract. Updates distinguish omitted fields from explicit `null`: null clears phone/identity; display name cannot be cleared. These fields are provisional demographics, not an approved clinical schema. This search deliberately describes the existing bounded service behavior rather than claiming the shared draft's proposed cursor pagination.

POST/PATCH require `Content-Type: application/json`, accept one JSON document up to 16 KiB, and reject unknown fields. The server selects the actor from the cookie session; body/header actor and role fields cannot authorize a request. Patient creation/update and their critical audit event commit or roll back together. A stale version or duplicate supplied identity conflicts without returning another patient's details.

## Session and CSRF behavior

The existing `POST /auth/login`, `GET /auth/session`, `POST /auth/logout` wire shapes remain in [shared-contract.md](shared-contract.md). Cookies stay Secure, HttpOnly, SameSite=Lax, Path=/, no Domain. Every protected unsafe method requires the exact configured HTTPS `Origin` and `X-CSRF-Token` issued for that session. Origin suffixes, `null`, missing origin, missing/mismatched token and cross-site fetches fail. Ordinary protected requests validate and refresh idle time without rotating CSRF. `GET /auth/session` still explicitly rotates it; the UI must retain that returned token and coordinate refreshes.

Missing/invalid/expired/revoked/disabled session returns 401; bad mutation origin/CSRF returns 403; malformed/unknown/oversized JSON returns 400; valid JSON with invalid fields returns 422; duplicate identity/stale version returns 409; absent/inaccessible patient ID returns 404; database failure returns generic 503. Role-denied registration/search returns 403. No response includes secret hashes, database errors, passwords or clinical notes.

## Review/publication gate

This packet is the concrete implementation for review. The published [OpenAPI](openapi.yaml) retains reviewed operational endpoints until F/B/C and DEC07 contract review; it points here so it does not falsely claim these routes are unimplemented. Do not publish proposed clinical/billing/report/export paths. Module owners must integrate reviewed role **and record** rules and tests before registration. No production clinical assignment adapter, therapist projection, account screen or complete AT evidence is claimed.
