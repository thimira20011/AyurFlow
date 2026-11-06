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

const root = fileURLToPath(new URL("../../", import.meta.url));

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

test("encrypted PostgreSQL backup restores records and rejects unsafe recovery", { timeout: 120_000 }, async t => {
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
  assert.ok(record.recoveryDurationMs > 0);
  assert.ok(record.backupAgeSeconds >= 0);
  const failed = path.join(directory, "failed");
  const missing = new URL(source); missing.pathname = `/missing_${suffix}`;
  assert.notEqual((await runScript("backup.mjs", [failed], { BACKUP_DATABASE_URL: missing.href, BACKUP_RECIPIENT: recipient.trim() })).code, 0);
  await assert.rejects(readFile(path.join(failed, "manifest.json")));
});
