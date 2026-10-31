# Shared API contract

`openapi.yaml` describes implemented endpoints only. Add reviewed protected resource contracts as their behavior is implemented. Planned resources: auth, users/roles, patients, encounters/addenda, plans/stages, rooms/availability, sessions, botanical items/batches, recipes, preparations/consumption, invoices/receipts, reports and audit events.

[Shared API and security contract](shared-contract.md) is the TASK-SET-04 review draft with request/response examples and pending DEC07 choices. Its example routes are proposals, not implemented OpenAPI paths.

[Member B's patient and clinical contract](member-b-contract.md) is the TASK-SET-06 contribution draft. It records proposed relationships, protected resource shapes and the B/C session-clearance join for review; it is not an implemented endpoint list.

Use `/api/v1`, consistent errors and parameterized SQL. HTTP conventions: 400 malformed input; 401 unauthenticated; 403 forbidden; 404 absent/inaccessible resource where appropriate; 409 state/concurrency conflict; 422 field validation. Choose bounded list responses and stable pagination in TASK-SET-04/06.

Document backend roles and record restrictions per endpoint. Consumption and receipts carry unique operation identifiers; identical successful retries return the original result, changed payload retries conflict. The final request field and session/CSRF contract is pending DEC07. Do not mark planned endpoints implemented or expose them without permission checks.
