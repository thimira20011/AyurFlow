import { readFile, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { checksum, command, connection, fingerprint, maximumBytes, query } from "./common.mjs";

let temporary;
try {
  if (!process.argv[2] || !process.argv[3]) throw new Error("Supply the downloaded backup directory and a new evidence file path.");
  const directory = path.resolve(process.argv[2]);
  const target = connection(process.env.RESTORE_DATABASE_URL);
  const database = decodeURIComponent(target.pathname.slice(1));
  if (!/^ayurflow_restore_[a-z0-9_]+$/.test(database) || process.env.RESTORE_CONFIRM_DATABASE !== database) {
    throw new Error("Restore requires an ayurflow_restore_ database and its exact name in RESTORE_CONFIRM_DATABASE.");
  }
  if (!process.env.BACKUP_IDENTITY_FILE) throw new Error("Set BACKUP_IDENTITY_FILE to the private key held by the operator.");
  const manifest = JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8"));
  if (manifest.version !== 1 || manifest.format !== "pg_dump-custom+age" || !Number.isFinite(Date.parse(manifest.startedAt))) throw new Error("Unsupported backup manifest.");
  if (fingerprint(target) === manifest.source) throw new Error("The restore target must differ from the backup source.");
  const archive = path.join(directory, "database.dump.age");
  const size = (await stat(archive)).size;
  if (size > maximumBytes || size !== manifest.bytes || await checksum(archive) !== manifest.sha256) throw new Error("Backup size or checksum verification failed.");
  const objects = await query(target.href, `SELECT
    (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema') +
    (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema')`);
  if (objects !== "0") throw new Error("Restore target must be empty. Existing objects are preserved.");
  temporary = await mkdtemp(path.join(tmpdir(), "ayurflow-restore-"));
  const plain = path.join(temporary, "database.dump");
  const started = Date.now();
  const decrypt = command("age", ["--decrypt", "--identity", process.env.BACKUP_IDENTITY_FILE, "--output", plain, archive]);
  decrypt.child.stdout.resume();
  await decrypt.done;
  // Finish authenticated decryption before any target mutation.
  const restore = command("pg_restore", ["--dbname", database, "--no-owner", "--no-acl", "--single-transaction", "--exit-on-error", plain], target.href);
  restore.child.stdout.resume();
  await restore.done;
  const categories = {};
  for (const table of ["patients", "stock_batches", "invoices", "audit_events"]) {
    const exists = await query(target.href, `SELECT to_regclass('public.${table}') IS NOT NULL`);
    categories[table] = exists === "t" ? Number(await query(target.href, `SELECT count(*) FROM public.${table}`)) : null;
  }
  const evidence = { verifiedAt: new Date().toISOString(), backupAgeSeconds: Math.max(0, (Date.now() - Date.parse(manifest.startedAt)) / 1000),
    recoveryDurationMs: Date.now() - started, target: fingerprint(target), categories,
    allCategoriesPresent: Object.values(categories).every(value => value !== null) };
  await writeFile(process.argv[3], JSON.stringify(evidence, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  console.log(`Isolated restore complete (${evidence.recoveryDurationMs} ms). Four-category coverage: ${evidence.allCategoriesPresent}.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (temporary) await rm(temporary, { recursive: true, force: true });
}
