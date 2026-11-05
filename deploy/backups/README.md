# Encrypted backup and isolated recovery

TASK-OPS-02. Owner A, reviewer F pending team assignment. SRS OPS-02 and NFR-05, AT16. Existing forward migrations and module data are the prerequisites. This implementation supports the synthetic Render/Neon environment.

## Approved synthetic settings

On 5 November 2026, Member A selected private repository `thimira20011/AyurFlow-backups`, seven daily backups and a maximum encrypted archive size of 48 MiB. Member A (THIMIRA) holds the private decryption key and operates restores. The backup job receives only the corresponding public key. The selected SQL backup role is `ayurflow_backup`, a direct TLS-verified, read-only maintenance connection. `grants.sql` grants current and future objects created by the migration owner. Reapply/review it when another migration owner or schema is introduced.

The private identity is stored outside the workspace at `C:\Users\THIMIRA\Documents\AyurFlow Backup Keys\identity.txt`, with Windows ACL access restricted to THIMIRA. Copy it into a protected password manager or offline device before relying on recovery. Keep that independent copy separate from backup storage. Losing all copies of this key makes the encrypted archives unrecoverable.

## Scheduled backup

The private backup repository contains copies of `scripts/backups/` and the templates `nightly.yml` and `monitor.yml` as `.github/workflows/nightly.yml` and `.github/workflows/monitor.yml`. Review and synchronize those copies when these source files change.

Set these private-repository Actions settings.

| Setting | Type | Purpose |
| --- | --- | --- |
| `BACKUP_DATABASE_URL` | Secret | Direct URL for the read-only backup role, `sslmode=verify-full` |
| `BACKUP_RECIPIENT` | Variable | Operator's age X25519 public recipient |
| `BACKUP_ENABLED` | Variable | `true` enables scheduled and manual jobs |

The daily schedule is 01:47 Asia/Colombo. GitHub schedules can be delayed. The independent 02:47 check fails when no unexpired daily archive younger than 26 hours exists. Both workflows support manual dispatch. Enable failed-workflow notifications in the operator's GitHub notification settings and inspect the most recent artifact daily. The 26-hour check is a monitoring grace period for this synthetic setup. Record actual backup age in restore evidence.

The job streams `pg_dump` custom format directly into `age`. Plain dumps are never written by the backup command. It publishes `database.dump.age` and a small manifest only when both subprocesses complete successfully, the encrypted size stays within the cap and the ciphertext checksum is available. Failed exports are removed. Archive metadata contains timestamps, a source fingerprint, sizes and a digest, with no row contents or credentials.

Artifacts are named `ayurflow-daily-YYYY-MM-DD`, retained for seven days and replaced on successful same-day reruns. At most approximately eight daily artifacts can overlap during expiry processing, below 385 MiB at the configured cap plus small metadata overhead. Account-wide existing Actions/Packages usage still reduces available quota. Set the GitHub billing budget to stop metered usage at the free allowance. Archive artifacts consume Actions storage; encrypted bytes are not committed to Git or attached to public releases.

## Manual export

Install Node 22.23.2, PostgreSQL 18 clients and age. The local verification uses age 1.3.2. Ubuntu automation installs its maintained age package and PostgreSQL 18 from the official PostgreSQL apt repository. Keep client versions compatible with the source server. Migrations and runtime role creation are separate from the database dump.

```powershell
# Set through your local secret manager or process environment.
# BACKUP_DATABASE_URL = the direct, read-only backup connection
# BACKUP_RECIPIENT = your public age recipient
node scripts/backups/backup.mjs backups/manual-YYYY-MM-DD
```

Download the entire private artifact from a known successful run before recovery. Check its age and retain the original ciphertext during the restore rehearsal.

## Isolated restore

Create a new empty database whose name begins with `ayurflow_restore_`, using the same or a compatible PostgreSQL version with extension installation privileges. Give the restore connection access only to this recovery environment. Keep the public application pointed at its existing database. Global database roles are provisioned separately, following the deployment guide; `pg_dump` does not export their passwords.

```powershell
$env:RESTORE_DATABASE_URL = '<isolated direct connection from your secret manager>'
$env:RESTORE_CONFIRM_DATABASE = 'ayurflow_restore_rehearsal'
$env:BACKUP_IDENTITY_FILE = 'C:\Users\THIMIRA\Documents\AyurFlow Backup Keys\identity.txt'
node scripts/backups/restore.mjs backups/downloaded-backup backups/restore-evidence.json
```

The tool checks the exact target name, rejects the original source and any existing user objects, verifies ciphertext size/checksum and finishes authenticated decryption before import. It uses an operator-local temporary directory for the decrypted archive and deletes it afterward. PostgreSQL restores in one transaction with no source role ownership/ACLs. A failure rolls the import back. The tool never passes database passwords on the command line. Use only archives produced by the trusted backup workflow, because restoring SQL executes its definitions.

The evidence file records UTC verification time, backup age, measured recovery duration and counts for `patients`, `stock_batches`, `invoices` and `audit_events`, matching the current inventory contract. Missing categories are reported as `null`; they do not pass four-category acceptance. Inspect specific synthetic records and their relationships after the restore, then delete the disposable recovery database through your normal database administration process. A controlled restart and an isolated recovery prove different behaviors.

## Verification and acceptance

Run `node --test scripts/backups/backup.test.mjs`. Set `BACKUP_TEST_DATABASE_URL` to a disposable PostgreSQL maintenance database with database-creation permission for the real integration case. The test creates and removes only random `ayurflow_restore_` databases. CI requires the integration configuration and exercises all four synthetic record categories, Unicode, wrong key, tampered archive, non-empty target, source-target collision and failed export cleanup.

Full AT16 remains open until the actual four module record categories, paper outage/audited re-entry procedure, key custody copy, failure notification receipt and named reviewer are verified. The current application lacks the inventory batch table. Real clinic data still requires DEC05 authorization and reviewed retention/operations decisions.

## Execution record — 5 November 2026

Codex automation tested this slice on Windows with Node 22.23.2, PostgreSQL client 18.6 and age 1.3.2, against the synthetic Neon branch `production` in `small-heart-76292130`. Source baseline was merged PR #62 (`cca6f7e`) plus this branch's backup changes. Owner A, reviewer F pending. The current inventory contract names its future table `stock_batches`.

The private repository was created with no application/key files committed. Only the read-only `BACKUP_DATABASE_URL` secret and public `BACKUP_RECIPIENT`/enable variables are configured in Actions. The identity file's Windows ACL was checked and grants access only to THIMIRA. An independent key copy and receipt of failure notifications require the operator's follow-through.

The first private backup failed because libpq needed an explicit trusted CA-store setting. The fix selects the system trust store with verified TLS; local Windows verification uses Node's trusted CA bundle. A local integration run also found Windows command-line Unicode conversion in SQL fixture setup. Passing UTF-8 SQL through standard input and explicitly selecting UTF-8 fixed that issue. Large official client downloads were interrupted, so the required client executables/libraries were retrieved from the official archive in verified small ranges. The initial permission review for key creation timed out; its permitted retry completed. No private key content or raw dump was printed.

Both local Node tests passed with no skipped cases against disposable real PostgreSQL databases. Coverage includes four synthetic fixture categories and Unicode, wrong private key, checksum mismatch, authenticated ciphertext tampering, unchanged non-empty targets, source-target collision and failed-export cleanup.

The [private backup run 42038337225](https://github.com/thimira20011/AyurFlow-backups/actions/runs/42038337225) succeeded, storing artifact `ayurflow-daily-2026-11-05` (68,857 bytes including packaging; encrypted archive 68,249 bytes). The [freshness run 42038834379](https://github.com/thimira20011/AyurFlow-backups/actions/runs/42038834379) passed. At this observed size, seven daily archives use under 0.5 MiB, excluding any other account usage.

The actual off-host artifact was downloaded, checksum-checked, decrypted using the locally held key and restored into a new empty Neon recovery database. Backup creation took 23.880 seconds. Measured recovery took 21.110 seconds with a backup age of 187.392 seconds at verification. Counts were four patients, four audit events, zero invoices and no `stock_batches` table. A known synthetic patient and its linked audit actor/event were independently verified after import. Both temporary recovery databases were removed after inspection, matched against their recorded target fingerprints.

The four-category synthetic integration fixture passed. The actual deployment recovery remains a partial AT16 result because actual batch data and an invoice example are unavailable. Paper outage/re-entry, reviewer acceptance, independent key copy, notification receipt and account-wide free-budget confirmation remain open. No recovery-time SLA is asserted.

Sources are [PostgreSQL pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html), [pg_restore](https://www.postgresql.org/docs/18/app-pgrestore.html), [age](https://age-encryption.org/), [GitHub artifact retention](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts) and [GitHub included usage](https://docs.github.com/en/billing/reference/product-usage-included).
