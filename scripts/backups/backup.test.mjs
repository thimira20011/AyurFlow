import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checksum, command, connection, query } from "./common.mjs";
import { verificationSQL } from './verify-records.mjs';

const root = fileURLToPath(new URL("../../", import.meta.url));

test('record verification rejects SQL payloads and inexact quantities before querying', () => {
  const valid = { patientId: '11111111-1111-4111-8111-111111111111', batchId: '22222222-2222-4222-8222-222222222222', invoiceId: '33333333-3333-4333-8333-333333333333', batchGrams: '100.125', invoiceTotalMinor: 12345 };
  assert.match(verificationSQL(valid), /stock_batch.received/);
  for (const field of ['patientId', 'batchId', 'invoiceId']) assert.throws(() => verificationSQL({ ...valid, [field]: "x'; DROP TABLE patients;--" }));
  for (const batchGrams of ['0.000', '1e3', '1.0001', "1.000; SELECT 1", 100]) assert.throws(() => verificationSQL({ ...valid, batchGrams }));
  for (const invoiceTotalMinor of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => verificationSQL({ ...valid, invoiceTotalMinor }));
});

test("direct, verified database connections are required", () => {
  assert.throws(() => connection("https://example.com"));
  assert.throws(() => connection("postgres://user:secret@ep-test-pooler.example/db?sslmode=verify-full"));
  assert.throws(() => connection("postgres://user:secret@remote.example/db?sslmode=require"));
  assert.equal(connection("postgres://user:secret@localhost/test?sslmode=disable").pathname, "/test");
  assert.equal(connection("postgres://user:secret@remote.example/db?sslmode=verify-full").hostname, "remote.example");
});

test("freshness monitor detects a missed daily backup", async t => {
  const directory = await mkdtemp(path.join(tmpdir(), "ayurflow-monitor-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const template = existsSync(path.join(root, "deploy/backups/monitor.yml"))
    ? "deploy/backups/monitor.yml" : ".github/workflows/monitor.yml";
  const workflow = await readFile(path.join(root, template), "utf8");
  const match = workflow.match(/<<'NODE'\r?\n([\s\S]*?)\r?\n\s+NODE/);
  assert.ok(match, "monitor must contain its executable Node check");
  const artifact = { name: "ayurflow-daily-2026-11-05", expired: false, created_at: new Date().toISOString() };
  for (const sample of [
    { name: "recent", artifacts: [artifact], expected: 0 },
    { name: "missing", artifacts: [], expected: 1 },
    { name: "expired", artifacts: [{ ...artifact, expired: true }], expected: 1 },
    { name: "missed yesterday", artifacts: [{ ...artifact, created_at: new Date(Date.now() - 25 * 3600000).toISOString() }], expected: 1 },
  ]) {
    await t.test(sample.name, async () => {
      const file = path.join(directory, "artifacts.json");
      await writeFile(file, JSON.stringify({ artifacts: sample.artifacts }));
      const result = spawnSync(process.execPath, ["-", file], { input: match[1], encoding: "utf8" });
      assert.equal(result.status, sample.expected, sample.name);
    });
  }
});

async function runScript(name, args, env) {
  const child = spawn(process.execPath, [path.join(root, "scripts/backups", name), ...args], {
    env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", chunk => { output += chunk; });
  child.stderr.on("data", chunk => { output += chunk; });
  const code = await new Promise((resolve, reject) => { child.once("error", reject); child.once("close", resolve); });
  return { code, output };
}

test("encrypted PostgreSQL backup restores records and rejects unsafe recovery", { timeout: 180_000 }, async t => {
  const database = process.env.BACKUP_TEST_DATABASE_URL;
  if (!database) {
    if (process.env.CI) assert.fail("BACKUP_TEST_DATABASE_URL is required in CI");
    t.skip("Requires disposable PostgreSQL, age and PostgreSQL client tools");
    return;
  }
  const suffix = randomBytes(8).toString("hex");
  const sourceName = `ayurflow_restore_source_${suffix}`;
  const targetName = `ayurflow_restore_target_${suffix}`;
  const source = new URL(database); source.pathname = `/${sourceName}`;
  const target = new URL(database); target.pathname = `/${targetName}`;
  const directory = await mkdtemp(path.join(tmpdir(), "ayurflow-backup-test-"));
  const identity = path.join(directory, "identity.txt");
  const wrongIdentity = path.join(directory, "wrong.txt");
  t.after(async () => {
    await query(database, `DROP DATABASE IF EXISTS ${sourceName} WITH (FORCE)`);
    await query(database, `DROP DATABASE IF EXISTS ${targetName} WITH (FORCE)`);
    await rm(directory, { recursive: true, force: true });
  });
  await query(database, `CREATE DATABASE ${sourceName}`);
  await query(database, `CREATE DATABASE ${targetName}`);
  for (const key of [identity, wrongIdentity]) {
    const generated = command("age-keygen", ["--output", key]); generated.child.stdout.resume(); await generated.done;
  }
  const recipientCommand = command("age-keygen", ["-y", identity]);
  let recipient = "";
  for await (const chunk of recipientCommand.child.stdout) recipient += chunk;
  await recipientCommand.done;
  for (const table of ["patients", "stock_batches", "invoices", "audit_events"]) {
    await query(source.href, `CREATE TABLE ${table} (id integer PRIMARY KEY, label text NOT NULL);
      INSERT INTO ${table} VALUES (1,'Synthetic Unicode ආයුර්වේද');`);
  }
  const backup = path.join(directory, "complete");
  const result = await runScript("backup.mjs", [backup], { BACKUP_DATABASE_URL: source.href, BACKUP_RECIPIENT: recipient.trim() });
  assert.equal(result.code, 0, result.output);
  const archive = path.join(backup, "database.dump.age");
  const bytes = await readFile(archive);
  assert.equal(bytes.subarray(0, 22).toString(), "age-encryption.org/v1\n");
  const restoreEnv = { RESTORE_DATABASE_URL: target.href, RESTORE_CONFIRM_DATABASE: targetName, BACKUP_IDENTITY_FILE: identity };
  const evidence = path.join(directory, "restore.json");
  assert.notEqual((await runScript("restore.mjs", [backup, evidence], { ...restoreEnv, RESTORE_DATABASE_URL: source.href, RESTORE_CONFIRM_DATABASE: sourceName })).code, 0);
  assert.notEqual((await runScript("restore.mjs", [backup, evidence], { ...restoreEnv, BACKUP_IDENTITY_FILE: wrongIdentity })).code, 0);
  await query(target.href, "CREATE TABLE marker(id int); INSERT INTO marker VALUES (7)");
  assert.notEqual((await runScript("restore.mjs", [backup, evidence], restoreEnv)).code, 0);
  assert.equal(await query(target.href, "SELECT id FROM marker"), "7");
  await query(target.href, "DROP TABLE marker");
  const manifestPath = path.join(backup, "manifest.json");
  const originalManifest = await readFile(manifestPath, "utf8");
  const changed = Buffer.from(bytes); changed[changed.length - 1] ^= 1;
  await writeFile(archive, changed);
  assert.notEqual((await runScript("restore.mjs", [backup, evidence], restoreEnv)).code, 0);
  const manifest = JSON.parse(originalManifest); manifest.sha256 = await checksum(archive);
  await writeFile(manifestPath, JSON.stringify(manifest));
  assert.notEqual((await runScript("restore.mjs", [backup, evidence], restoreEnv)).code, 0);
  assert.equal(await query(target.href, "SELECT count(*) FROM pg_tables WHERE schemaname='public'"), "0");
  await writeFile(archive, bytes); await writeFile(manifestPath, originalManifest);
  const restored = await runScript("restore.mjs", [backup, evidence], restoreEnv);
  assert.equal(restored.code, 0, restored.output);
  for (const table of ["patients", "stock_batches", "invoices", "audit_events"]) {
    assert.equal(await query(target.href, `SELECT label FROM ${table} WHERE id=1`), "Synthetic Unicode ආයුර්වේද");
  }
  const record = JSON.parse(await readFile(evidence, "utf8"));
  assert.equal(record.allCategoriesPresent, true);
  assert.equal(record.allCategoriesPopulated, true);
  assert.ok(record.recoveryDurationMs > 0);
  assert.ok(record.backupAgeSeconds >= 0);
  // A separate relational fixture checks the proof query, beyond table counts.
  const expected = { patientId: '11111111-1111-4111-8111-111111111111', batchId: '22222222-2222-4222-8222-222222222222', invoiceId: '33333333-3333-4333-8333-333333333333', batchGrams: '100.125', invoiceTotalMinor: 12345 };
  const actor = '44444444-4444-4444-8444-444444444444';
  await query(target.href, `
    ALTER TABLE patients RENAME TO original_patients;
    ALTER TABLE stock_batches RENAME TO original_batches;
    ALTER TABLE invoices RENAME TO original_invoices;
    ALTER TABLE audit_events RENAME TO original_audits;
    CREATE TABLE staff_accounts(id uuid PRIMARY KEY);
    CREATE TABLE patients(id uuid PRIMARY KEY, created_by uuid REFERENCES staff_accounts);
    CREATE TABLE botanical_items(id uuid PRIMARY KEY);
    CREATE TABLE stock_batches(id uuid PRIMARY KEY,item_id uuid REFERENCES botanical_items,received_grams numeric,remaining_grams numeric,received_by uuid REFERENCES staff_accounts);
    CREATE TABLE invoices(id uuid PRIMARY KEY,patient_id uuid REFERENCES patients,status text,total_minor_units bigint,issued_by uuid REFERENCES staff_accounts);
    CREATE TABLE audit_events(actor_id uuid REFERENCES staff_accounts,object_id text,action text);
    INSERT INTO staff_accounts VALUES ('${actor}');
    INSERT INTO patients VALUES ('${expected.patientId}','${actor}');
    INSERT INTO botanical_items VALUES ('${actor}');
    INSERT INTO stock_batches VALUES ('${expected.batchId}','${actor}',100.125,100.125,'${actor}');
    INSERT INTO invoices VALUES ('${expected.invoiceId}','${expected.patientId}','issued',12345,'${actor}');
    INSERT INTO audit_events VALUES ('${actor}','${expected.patientId}','patient.created'),('${actor}','${expected.batchId}','stock_batch.received'),('${actor}','${expected.invoiceId}','invoice.issued');`);
  const expectedFile = path.join(directory, 'expected.json');
  await writeFile(expectedFile, JSON.stringify(expected));
  const proof = path.join(directory, 'records.json');
  assert.equal((await runScript('verify-records.mjs', [expectedFile, evidence, proof], restoreEnv)).code, 0);
  assert.equal(JSON.parse(await readFile(proof, 'utf8')).passed, true);
  await query(target.href, "DELETE FROM audit_events WHERE action='invoice.issued'");
  const rejected = path.join(directory, 'missing-audit.json');
  assert.notEqual((await runScript('verify-records.mjs', [expectedFile, evidence, rejected], restoreEnv)).code, 0);
  assert.equal(JSON.parse(await readFile(rejected, 'utf8')).checks.invoiceAudit, false);
  const wrongTarget = JSON.parse(await readFile(evidence, 'utf8'));
  wrongTarget.target = 'wrong';
  const wrongEvidence = path.join(directory, 'wrong-target.json');
  await writeFile(wrongEvidence, JSON.stringify(wrongTarget));
  assert.notEqual((await runScript('verify-records.mjs', [expectedFile, wrongEvidence, path.join(directory, 'no-proof.json')], restoreEnv)).code, 0);
  assert.equal(await query(target.href, 'SELECT count(*) FROM invoices'), '1');
  const failed = path.join(directory, "failed");
  const missing = new URL(source); missing.pathname = `/missing_${suffix}`;
  assert.notEqual((await runScript("backup.mjs", [failed], { BACKUP_DATABASE_URL: missing.href, BACKUP_RECIPIENT: recipient.trim() })).code, 0);
  await assert.rejects(readFile(path.join(failed, "manifest.json")));
});
