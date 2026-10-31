# Administration module

Proposed owner: A. Reviewer: F. SRS: ADM-01; IAM-01.

Explicit role assignment, controlled accounts and permitted reference data. Administrator alone does not grant clinical access.

AUTH-04 implements controlled staff creation, bounded listing, explicit role assignment and disabling. The service checks current active administrators and audits changes atomically with session revocation. No credentials/secrets are returned or audited. Canonical UUID self-guards and serialized mutations preserve an active administrator under competing requests. See [the implemented contract](../../../docs/api/auth-04-staff.md) for routes, locks, initial-password policy, tests and review gates. No schema migration, signup, reset/reactivation, recovery or reference-data management is added. Shared HTTP transport handlers use the existing session/CSRF middleware.

TASK-OPS-03 staff instructions are in [Member A's administration guide](../../../docs/guides/member-a-administration.md); operator setup, migrations and outage/re-entry are in [the operations runbook](../../../docs/operations.md). A named member's synthetic walkthrough and F review remain required before handover.
