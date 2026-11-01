# Staff access and administration — staff guide

**Owner:** Member A · **Reviewer:** Member F · **Task:** TASK-OPS-03 (A's portion) · **Requirements:** IAM-01–05, ADM-01 and AUD-01–02 support · **Acceptance:** AT01/AT13 and AT17 documentation support

This guide describes the implemented synthetic-development application. Use synthetic accounts and records until the clinic/institution authorizes real data under DEC05. Session, recovery and production credential policies still require DEC07 review. Another member must verify these instructions before handover.

## Sign in and end a session

1. Open the configured **HTTPS** application address and select **Sign in**. Enter your assigned login identifier and password. Accounts are created by administrators; public sign-up is unavailable.
2. After sign-in, the **Staff workspace** shows areas assigned to your roles. Select an area to open it. A visible work area does not prove its feature is complete or grant access to every record.
3. If the session ends, sign in with your own account and reopen the record. Check whether an earlier change saved before submitting it again. Session timeouts and login throttling use the environment's explicitly configured settings; this guide selects no defaults.
4. Select **Sign out** when finished. If the application says sign-out could not be confirmed, retry when the service is available and report the problem; treat the session as potentially active. Closing a tab is not confirmed server-side logout.

Repeated unsuccessful sign-in can trigger a temporary block. Ask the administrator to check account status and the configured policy rather than repeatedly trying passwords. Never share accounts or send passwords, cookies or security tokens to support.

## Create a staff account

This requires an active **administrator** account. Initial synthetic bootstrap is an operator task described in the [operations runbook](../operations.md); there is no production bootstrap or password-recovery workflow yet.

1. From **Staff workspace**, select **Staff administration**.
2. In **Create staff account**, enter a unique **Login identifier**, an **Initial password**, and the required roles under **Assign roles**. Choose only roles approved for that staff member's duties.
3. Use at least **15 Unicode characters** for an administrator-created initial password. The server also limits it to 1,024 UTF-8 bytes. Login identifiers are trimmed/lowercased, limited to 64 UTF-8 bytes and cannot contain control characters.
4. Select **Create account** once. After **Staff account created**, provide the initial password privately through the agreed credential channel. Do not record it in tickets, screenshots or Git.
5. Confirm the account and roles in **Staff accounts**. The list contains up to 25 accounts per page; use **Next page** or **Refresh first page** to navigate it. Newly created accounts need not appear on the first page.

If a request times out or its outcome cannot be confirmed, refresh and inspect the pages before trying again. A duplicate identifier is a conflict, not a reason to create a second identity. The application has no password reset, forced first-password change, account reactivation or account deletion action.

## Change roles or disable access

1. Find the correct login in **Staff accounts** and review its **Active** or **Disabled** status.
2. To change access, select the intended nonempty set of roles and choose **Save roles**. An actual role change ends that person's active sessions; they must sign in again.
3. To remove access, choose **Disable account**, verify the login in the confirmation, then confirm. After **Account disabled and sessions ended**, the account cannot sign in. Its historical references remain.
4. If the outcome is uncertain, refresh and inspect the current account state before another action. Disabled accounts cannot receive role changes through this screen.

You cannot disable yourself or remove your own administrator role. Use another authorized administrator for those actions. Do not bypass a rejection by editing database rows. Account changes and session revocation commit with their audit event; a failed audit write rolls back the change too.

## Role and record boundaries

| Role | Current access boundary |
| --- | --- |
| Administrator | Staff account listing, creation, role changes and disabling. Administrator alone does not grant patient-demographic or clinical-note access. |
| Receptionist | Patient registration, search, demographic read/update through the protected patient routes. |
| Clinician | Clinical service access requires an explicit patient assignment. Clinical handlers exist, but the application does not register them while assignment authority awaits DEC02 review. |
| Therapist | Session access requires an explicit session assignment and the owning module's implementation. A role or booking alone does not establish clinical clearance. |
| Dispensary / billing | Work areas follow assigned roles; module-specific backend permissions still apply. Neither role gains unrestricted patient demographics from the shared policy. |
| Report reader | A catalog role is not a blanket report, export or audit permission. Each endpoint requires an implemented, reviewed policy. |

Multiple roles combine their explicit permissions. Assigning every role to make a request succeed is not an access-review procedure. There is no generic audit-history screen in this slice; use the reviewed module process when it becomes available.

## Errors and support

| Result | Action |
| --- | --- |
| Sign-in unavailable | Ask the operator to check HTTPS, authentication configuration and service status. |
| Session ended | Sign in again; reopen and check the latest state before retrying a change. |
| Staff administration not permitted | Ask an authorized administrator to review your role; do not use another person's account. |
| Session token changed | Refresh the page, inspect the current state, then deliberately resubmit if still needed. Another tab can rotate the token. |
| Account conflict | Refresh the list; check duplicate identifiers, disabled status and self-lockout restrictions. |
| Invalid fields | Correct the identifier, password or role selection and review before submitting. |
| Outcome uncertain / service unavailable | Stop repeated submissions; inspect the committed state when service returns and contact the operator. |

Give support the time and timezone, application version if known, screen/action and displayed error. Redact account/patient details unless the agreed support channel permits them. Never include a password, password hash, session cookie, CSRF token or clinical note body.

## Reviewer walkthrough

Member F or another named member should use a configured synthetic HTTPS environment to verify sign-in, account creation, list pagination when applicable, role changes, session invalidation, disabling, self-lockout rejection and uncertain-write handling. Include a non-administrator and verify backend denial as well as screen visibility. Follow the detailed [AUTH-06 procedure](../auth-06-verification.md) for AT01 evidence.

Record tester/reviewer, date, commit, browser/environment, setup, expected/actual results, evidence and defects using the [OPS-03 walkthrough record](../operations.md#ops-03-walkthrough-and-handover). Documentation review alone does not pass AT01, AT13 or AT17.
