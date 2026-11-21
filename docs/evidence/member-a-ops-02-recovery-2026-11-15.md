# OPS-02 four-category off-host recovery — 15 November 2026

TASK-OPS-02, SRS OPS-02/NFR-05, AT16; QA-04 finding follow-up supports AUD-01/02 and AT13. Owner A (THIMIRA); reviewer F or a named replacement, independent acceptance pending. Tester: Codex-authored automation operated for Member A, Windows, Node 22.23.4, PostgreSQL clients 18.6, age 1.3.2 and repository migration runner built with Go 1.27.4. Source baseline `6e3d431a5f216ec777fd5411edb41b05e24a8049` (merged PR #88). All application and recovery data are synthetic.

## Setup and deployment repair

Read-only inspection found only migrations through `000013` on the hosted synthetic Neon database. `stock_batches` was absent; existing invoices had zero orphan patient references. Private daily backup and freshness runs were succeeding against that older schema.

Downloaded the actual encrypted artifact from [private backup run 43655809437](https://github.com/thimira20011/AyurFlow-backups/actions/runs/43655809437). Restored it into a newly created `ayurflow_restore_preflight_…` database, retaining the public app's original database. The repository migration runner successfully applied pending migrations `000014`–`000017` to this restored copy. All 18 migration filenames were then present (including both historical `000004` files).

Only after that rehearsal, applied the same existing forward migrations to the synthetic deployment with its dedicated migration connection. Reapplied the reviewed runtime and read-only backup grants. Final inspection confirmed all 18 migration files, all four category tables, runtime batch/audit access, backup SELECT access and zero orphan invoice references. No applied migration was edited. `invoices_patient_fk` remains `NOT VALID` by E's design; historical validation needs its reviewed forward follow-up.

## Real API records and simulated outage re-entry

Used trusted HTTPS at `https://ayurflow-frontend-l65w.onrender.com`, exact Origin, session cookies and fresh CSRF. Created dedicated single-role receptionist, dispensary and billing accounts through administration. A local synthetic outage worksheet supplied the Unicode patient and reference for re-entry; no hosting outage was induced. Registered that patient, created a botanical item, received an untouched `100.125 g` batch, opened an invoice for that patient, added one `12345` minor-unit line and issued it. The API returned 201 for creations and 200 for issue. Those real service transactions wrote their own audit events. The three temporary staff accounts were disabled afterwards; committed records and audit history were retained.

Preliminary attempts encountered transient frontend HTTP 502 while backend readiness returned 200, an existing demo receptionist's denied patient write, and a local worksheet filename collision. No failed attempt is counted as passed. New dedicated accounts and unique worksheet references isolated the final successful run. Earlier temporary accounts were also disabled. No uncertain mutation was automatically retried and no real staff account roles were changed.

## Backup, restore and actual outcomes

Started [private backup run 43687771977](https://github.com/thimira20011/AyurFlow-backups/actions/runs/43687771977); it succeeded and published `ayurflow-daily-2026-11-15`, artifact ID `14150109043`. Encrypted archive: **127752 bytes**; packaged artifact: **128361 bytes**. Backup duration: **20.509 seconds**. Ciphertext SHA-256: `568e666aa92f90dae43a29c9334cfc88c860353f5975d8baa2814d7007e5d732`.

Downloaded that off-host artifact, verified checksum and authenticated decryption with the operator's local identity file, and restored into a second new empty database. Private key contents were never read into conversation or committed. Verification completed **15 November 2026 12:30:20 Asia/Colombo** (07:00:20 UTC). Actual measured recovery duration: **30.558 seconds**. Backup age at restore verification: **123.411 seconds**. These are observed measurements, not a recovery SLA.

| Expected | Actual |
| --- | --- |
| Four categories exist and contain records | 5 patients, 1 stock batch, 1 invoice, 55 audit events; both presence/population flags true |
| Known synthetic patient restored | Exact patient UUID found |
| Known batch and quantity/link retained | Exact batch UUID; received and remaining `100.125 g`; referenced botanical item exists |
| Issued invoice retains patient and total | Exact invoice UUID; original patient UUID; issued status and `12345` LKR minor-unit total |
| Patient creation audit links to original staff actor | Passed |
| Stock receipt audit links to original staff actor | Passed |
| Invoice issue audit links to original staff actor | Passed |
| Daily artifact detected by independent freshness workflow | [Run 43687935776](https://github.com/thimira20011/AyurFlow-backups/actions/runs/43687935776) passed |
| Disposable recovery targets removed safely | Both names/fingerprints matched their recorded restore evidence before removal; source database retained |

The private expectation file, worksheet, ciphertext and safe JSON execution output remain under ignored `.cache/ops-02/`. This committed summary omits credentials, row contents and private identity material. Decrypted temporary dumps were removed by the restore runner.

## Code checks and remaining acceptance

Added separate table-population evidence and a read-only specific-record/audit verifier. The verifier requires an explicitly confirmed recovery database, matching target fingerprint, populated categories, validated UUIDs and exact positive numeric expectations. It creates new evidence files exclusively and exits nonzero on mismatches.

Local complete backup tests passed against disposable real PostgreSQL databases: **8 passed, 0 failed, 0 skipped**, including wrong identity, checksum/authentication tampering, nonempty target preservation, source-target collision, failed export cleanup, missing audit rejection, wrong-evidence-target rejection and invalid SQL/numeric input rejection. Earlier no-database execution skipped the integration case; that run is superseded by the complete execution. The dedicated relational test fixture validates the proof query separately from the actual off-host application-schema rehearsal above. Record the branch's CI result separately.

Member A reported completion of the independent key copy and failure notifications. Independent confirmation, account-wide free-budget confirmation, named independent review, and the staff walkthrough remain open. The outage worksheet was a simulation. DEC05 real-data authorization, clinic retention and final operational decisions remain separate gates for OPS-02/AT16 acceptance.

## Private backup helper sync — 20 November 2026

After PR #89 merged, Member A's recovery helpers were synchronized to the private backup repository at `1cb88ba0b538d872e2a7a55beea3815bb1baac1e`. The three synced files are `restore.mjs`, `verify-records.mjs`, and `backup.test.mjs`. The private checkout's full backup tests ran on Windows with Node 22.23.4 against disposable PostgreSQL databases. All 8 passed with zero failures or skips, including actual encrypted restore, target matching and missing audit rejection. The 20 November scheduled backup and freshness runs also passed before the sync. [Private sync commit](https://github.com/thimira20011/AyurFlow-backups/commit/1cb88ba0b538d872e2a7a55beea3815bb1baac1e) · [Scheduled backup](https://github.com/thimira20011/AyurFlow-backups/actions/runs/44656201766) · [Freshness check](https://github.com/thimira20011/AyurFlow-backups/actions/runs/44660164487)
