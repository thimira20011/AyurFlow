# Audit module

**TASK-AUTH-05; owner A; reviewer F; SRS AUD-01–02, PAT-02; verification AT13.**

`Write` records structured metadata in the caller's PostgreSQL transaction. `Reader.List` retrieves one object's history only after an explicit authorization adapter permits access. Migration `000004_audit_integrity.up.sql` adds changed-field names, bounded metadata constraints and protection against UPDATE, DELETE and TRUNCATE. Existing migrations are unchanged.

## Write from a module service

Authenticate and authorize the business action first. Use the same **top-level transaction** for the mutation and every associated audit event. Never use a pool, a separate transaction, a nested savepoint, a background goroutine or a best-effort log in place of this call. `Write` never commits; on any validation or database error it rolls back the supplied transaction. Propagate that error to the request boundary. Commit only after all business and audit writes succeed.

```go
// Illustrative module-service integration; Update belongs to the module owner.
return pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
    if err := repository.Update(ctx, tx, input); err != nil {
        return err
    }
    return audit.Write(ctx, tx, audit.Event{
        ActorID:       principal.StaffID,
        Action:        "patient.updated",
        Object:        audit.Object{Type: "patient", ID: patientID},
        ReasonCode:    "demographic_correction",
        ChangedFields: []string{"phone"},
    })
})
```

The request context flows through the service to pgx. Only rollback cleanup detaches cancellation, with a five-second limit. PostgreSQL assigns the event ID and event time; readers return UTC timestamps. Modules cannot submit backdated audit times. Record an original event date in the appropriate business field when an approved outage process requires it.

## Metadata contract

| Field | Source and allowed contents |
| --- | --- |
| `ActorID` | Nonzero staff UUID from the authenticated server principal, never a request-body actor. The staff foreign key preserves attribution. |
| `Action` | Module constant, e.g. `patient.updated`, `consultation.signed`, `staff.roles_changed`. Lowercase dotted code, at most 96 bytes. |
| `Object` | Stable object type code and stored record ID. No patient names, notes, login credentials or session tokens. IDs may be UUIDs or reference codes. |
| `ReasonCode` | Optional module-selected lowercase code, at most 64 bytes; provide it when the action requires a reason. Store detailed reasons in the protected source record/history, linked by the object ID. |
| `ChangedFields` | At most 32 distinct field-name codes, e.g. `phone`; never old/new field values. Use an empty list for actions without a field change. |

There is deliberately no generic JSON payload, note body, password, token or before/after value map. Go and PostgreSQL reject free text in metadata fields. Validation cannot recognize a secret disguised as a valid code: callers must choose constants and identifiers from trusted server code and must never copy arbitrary request values into these fields. Review each module's action/required-reason list and tests when integrating it.

AUD-01 covers account/role changes, demographic changes, signing/addenda, plan approval/status changes, booking changes, batch blocks/receipts, preparation confirmation, invoice issue and payment receipt creation. Each feature owner supplies its calls and tests; this shared package does not implement those modules.

## Restricted retrieval and remaining gates

`NewReader(pool, authorizer)` requires a `ReadAuthorizer` implementing `AuthorizeAuditRead(ctx, requesterID, object)`. AUTH-03 must supply an adapter that checks explicit audit permission **and** access to the underlying record. Missing adapters deny access; there is no implicit administrator or report-reader grant. The reader also rejects inactive/missing accounts. A handler must pass the requester from its authenticated server principal and must never expose caller-selected authorization or requester IDs.

`List` requires an object type and ID. It returns up to 25 events by default, at most 100, ordered by descending event ID. For another page, pass the last returned ID as `BeforeID`. This order is stable by ID, not a claim about concurrent transaction commit order. There is no unscoped export operation or public database repository.

**No audit HTTP route or UI is registered in this task.** AUTH-03 route/record permissions and their review must exist before registration; OpenAPI continues to describe only reviewed routes. AT13 remains open until module mutations and direct API access checks are integrated and reviewed.

The database triggers reject ordinary DML even for the table owner. They cannot prevent a privileged database administrator from changing DDL, disabling triggers or dropping storage. OPS-01 must separate application and migration roles: grant the application only required SELECT/INSERT and sequence access, and no UPDATE/DELETE/TRUNCATE/DDL privileges. No clinical permission follows from database access or an administrator role.

## Verification

Unit tests exercise validation, required transactions, failure rollback, cancellation cleanup and denied/unbounded reads. PostgreSQL tests prove commit/rollback behavior, forced storage failure, retained metadata, update/delete/truncate rejection, database validation, object isolation, pagination and disabled-account rejection. Tests use synthetic data and generate isolated schemas; cleanup drops only their generated schema. `AUDIT_TEST_DATABASE_URL` must point to a **disposable** database with schema/migration privileges.

```powershell
Set-Location backend
go test ./internal/audit
# Configure AUDIT_TEST_DATABASE_URL locally; never commit or print its secret value.
go test -tags=integration -count=1 -v ./internal/audit
```

GitHub Actions supplies disposable PostgreSQL and runs auth/audit integration tests with the race detector. Module owners must still force audit failure in each real business workflow; synthetic shared-mechanism proof does not pass all of AT13.
