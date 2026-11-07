// OPS-04: always creates its own disposable Compose project; never reads app .env files.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const root = fileURLToPath(new URL("../../", import.meta.url));
const project = `ayurflow-ops04-${randomBytes(6).toString("hex")}`;
const cache = path.join(root, ".cache/ops-04", project);
mkdirSync(cache, { recursive: true, mode: 0o700 });
const log = path.join(cache, "private.log");
writeFileSync(log, "", { mode: 0o600 });
const secret = () => randomBytes(24).toString("hex");
const ownerPassword = secret(), migrationPassword = secret(), appPassword = secret(), password = secret();
const secrets = [ownerPassword, migrationPassword, appPassword, password];
function file(name, value) {
  const target = path.join(cache, name);
  // Disposable random credentials; container's non-root user must read bind-mounted files.
  writeFileSync(target, value, { mode: 0o644 });
  return target;
}
const env = {
  ...process.env, AYURFLOW_DOMAIN: "localhost", CADDY_IMAGE: "caddy:2.10.2-alpine",
  APPLICATION_DATABASE_URL_FILE: file("application.dsn", `postgres://ops04_app:${appPassword}@db:5432/ayurflow_ops04?sslmode=disable`),
  MIGRATION_DATABASE_URL_FILE: file("migration.dsn", `postgres://ops04_migrator:${migrationPassword}@db:5432/ayurflow_ops04?sslmode=disable`),
  VERIFICATION_DATABASE_PASSWORD_FILE: file("owner.password", ownerPassword),
  AUTH_IDLE_TIMEOUT: "5m", AUTH_ABSOLUTE_TIMEOUT: "1h", AUTH_ATTEMPT_LIMIT: "3",
  AUTH_ATTEMPT_WINDOW: "5m", AUTH_BLOCK_DURATION: "5m",
};
// Explicit files prevent Compose from loading the operator's database or host settings.
const emptyEnv = file("empty.env", "");
const args = ["compose", "--env-file", emptyEnv, "--project-name", project,
  "-f", path.join(root, "deploy/compose.pilot.yaml"), "-f", path.join(root, "deploy/verification/compose.yaml")];
function compose(command, input, extra = {}, allowFailure = false) {
  const result = spawnSync("docker", [...args, ...command], {
    cwd: root, env: { ...env, ...extra }, input, encoding: "utf8", timeout: 15 * 60_000, maxBuffer: 32 * 1024 * 1024,
  });
  appendFileSync(log, (result.stdout ?? "") + (result.stderr ?? ""));
  if (result.error || result.status !== 0) {
    if (allowFailure) return null;
    throw new Error(`Compose ${command[0]} failed; inspect the private local log.`);
  }
  return result.stdout.trim();
}
const sql = query => compose(["exec", "-T", "db", "psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "ayurflow_ops04"], query);
const steps = [];
function pass(message) { steps.push(message); console.log(`PASS: ${message}`); }
let ca, cookie = "", csrf = "";
function request(resource, method = "GET", data) {
  return new Promise((resolve, reject) => {
    const body = data === undefined ? undefined : JSON.stringify(data);
    const req = https.request({ hostname: "127.0.0.1", servername: "localhost", port: 3444, path: resource,
      ca, method, timeout: 10_000, headers: { Host: "localhost:3444", Origin: "https://localhost:3444",
        Cookie: cookie, "X-CSRF-Token": csrf, ...(body ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } : {}) },
    }, response => {
      let text = "";
      response.setEncoding("utf8").on("data", chunk => { text += chunk; });
      response.on("end", () => resolve({ status: response.statusCode, headers: response.headers, text }));
      response.on("error", () => reject(new Error("HTTPS response failed.")));
    });
    req.on("timeout", () => req.destroy());
    req.on("error", () => reject(new Error("HTTPS fixture request failed.")));
    req.end(body);
  });
}
async function ready() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await request("/api/v1/ready")).status === 200) return; } catch { /* Startup is bounded below. */ }
    await delay(1000);
  }
  throw new Error("HTTPS database readiness did not recover within 60 attempts.");
}
async function login() {
  cookie = ""; csrf = "";
  const response = await request("/api/v1/auth/login", "POST", { loginIdentifier: "ops04-reception", password });
  assert.equal(response.status, 200, "original seeded credentials must work");
  cookie = response.headers["set-cookie"]?.[0]?.split(";")[0] ?? "";
  assert(cookie.startsWith("__Host-ayurflow_session="), "secure session must be issued");
  csrf = JSON.parse(response.text).csrfToken;
  secrets.push(cookie.slice(cookie.indexOf("=") + 1), csrf);
  assert.deepEqual(JSON.parse(response.text).roles, ["receptionist"], "repeat seed must preserve roles");
}
const ledgerSQL = "SELECT json_agg(m ORDER BY version)::text FROM schema_migrations m";
let success = false, started = false;
try {
  const config = JSON.parse(compose(["--profile", "maintenance", "config", "--format", "json"]));
  for (const name of ["db", "backend", "frontend", "migrate"]) assert(!config.services[name].ports?.length, "only fixture HTTPS may be published");
  assert.equal(config.services.proxy.ports.length, 1);
  assert.equal(config.services.proxy.ports[0].host_ip, "127.0.0.1");
  assert.equal(String(config.services.proxy.ports[0].published), "3444");
  assert.deepEqual(config.services.backend.secrets.map(value => value.source), ["application_database_url"]);
  assert.deepEqual(config.services.migrate.secrets.map(value => value.source), ["migration_database_url"]);
  assert(!config.services.frontend.secrets?.length);
  pass("isolated project exposes only loopback HTTPS and separates database secrets");
  compose(["build", "migrate", "backend", "frontend"]);
  started = true;
  compose(["up", "--wait", "--wait-timeout", "120", "db"]);
  assert.equal(sql("SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"), "0");
  sql(`CREATE ROLE ops04_migrator LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${migrationPassword}';
    CREATE ROLE ops04_app LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${appPassword}';
    REVOKE ALL ON DATABASE ayurflow_ops04 FROM PUBLIC;
    GRANT CONNECT ON DATABASE ayurflow_ops04 TO ops04_migrator, ops04_app;
    ALTER SCHEMA public OWNER TO ops04_migrator;
    REVOKE ALL ON SCHEMA public FROM PUBLIC;
    CREATE EXTENSION btree_gist;`);
  compose(["run", "--rm", "--no-deps", "migrate"]);
  const ledger = sql(ledgerSQL);
  const expected = readdirSync(path.join(root, "backend/db/migrations")).filter(name => name.endsWith(".up.sql")).map(name => `migrations/${name}`).sort();
  assert.deepEqual(JSON.parse(ledger).map(row => row.version), expected);
  compose(["run", "--rm", "--no-deps", "migrate"]);
  assert.equal(sql(ledgerSQL), ledger, "repeat migrations must preserve versions and timestamps");
  pass(`all ${expected.length} migrations apply to an empty database and repeat without changes`);
  compose(["exec", "-T", "db", "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "ayurflow_ops04", "-v", "app_role=ops04_app", "-v", "schema=public"], readFileSync(path.join(root, "deploy/runtime-grants.sql"), "utf8"));
  const seed = { SEED_STAFF_LOGIN: "ops04-reception", SEED_STAFF_PASSWORD: password, SEED_STAFF_ROLES: "receptionist" };
  const seedCommand = ["run", "--rm", "--no-deps", "--entrypoint", "seedstaff", "-e", "APP_ENV=development",
    "-e", "SEED_STAFF_LOGIN", "-e", "SEED_STAFF_PASSWORD", "-e", "SEED_STAFF_ROLES", "migrate"];
  compose(seedCommand, undefined, seed);
  const staff = sql("SELECT json_agg(a)::text FROM staff_accounts a");
  const changedPassword = secret(); secrets.push(changedPassword);
  compose(seedCommand, undefined, { ...seed, SEED_STAFF_PASSWORD: changedPassword, SEED_STAFF_ROLES: "billing" });
  assert.equal(sql("SELECT json_agg(a)::text FROM staff_accounts a"), staff, "repeat seed must preserve the account and password hash");
  assert.equal(sql("SELECT bool_and(NOT (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)) FROM pg_roles WHERE rolname IN ('ops04_app','ops04_migrator')"), "t");
  assert.equal(sql("SELECT has_table_privilege('ops04_app','patients','INSERT') AND NOT has_table_privilege('ops04_app','schema_migrations','SELECT') AND NOT has_table_privilege('ops04_app','audit_events','UPDATE') AND NOT has_schema_privilege('ops04_app','public','CREATE')"), "t");
  pass("synthetic seed is repeatable and runtime database privileges stay restricted");
  compose(["up", "-d", "backend", "frontend", "proxy"]);
  for (let attempt = 0; attempt < 30; attempt++) {
    ca = compose(["exec", "-T", "proxy", "cat", "/data/caddy/pki/authorities/local/root.crt"], undefined, {}, true);
    if (ca) break;
    await delay(1000);
  }
  assert(ca, "fixture CA must exist");
  await ready();
  assert.equal((await request("/sign-in")).status, 200, "production-built Next.js must serve sign-in");
  assert.equal((await request("/api/v1/patients?q=Synthetic")).status, 401);
  await login();
  const displayName = `Synthetic නිමාලි ${project}`;
  const created = await request("/api/v1/patients", "POST", { displayName, birthDate: "1990-01-01", gender: "OTHER", phone: "+94770000001" });
  assert.equal(created.status, 201, "restricted API must commit the patient");
  const patient = JSON.parse(created.text);
  assert.match(patient.id, /^[0-9a-f-]{36}$/i);
  const persistedSQL = `SELECT json_build_object('patient',(SELECT row_to_json(p) FROM patients p WHERE id='${patient.id}'),
    'audit',(SELECT json_agg(a ORDER BY id) FROM audit_events a WHERE object_id='${patient.id}' AND action='patient.created'))::text`;
  const persisted = sql(persistedSQL);
  assert.equal(JSON.parse(persisted).audit.length, 1);
  pass("HTTPS frontend and protected API persist a Unicode patient with its audit event");
  const services = ["db", "backend", "frontend", "proxy"];
  const before = services.map(name => compose(["ps", "-q", name]));
  compose(["down", "--remove-orphans"]); // Keep this project's database and certificate volumes.
  compose(["up", "--wait", "--wait-timeout", "120", "db"]);
  compose(["run", "--rm", "--no-deps", "migrate"]);
  compose(["up", "-d", "backend", "frontend", "proxy"]);
  await ready();
  services.forEach((name, index) => { assert(before[index]); assert.notEqual(compose(["ps", "-q", name]), before[index], `${name} must be recreated`); });
  assert.equal(sql(ledgerSQL), ledger);
  assert.equal(sql(persistedSQL), persisted, "committed patient and audit history must survive recreation");
  await login();
  const found = await request(`/api/v1/patients?q=${encodeURIComponent(displayName)}`);
  assert.equal(found.status, 200);
  assert(JSON.parse(found.text).items.some(item => item.id === patient.id && item.displayName === displayName && item.patientCode === patient.patientCode));
  assert.equal((await request("/sign-in")).status, 200);
  pass("recreated database, API, frontend and proxy retain migrations, credentials, patient code and audit history");
  const logs = compose(["logs", "--no-color", "backend", "frontend", "proxy"]);
  assert(!secrets.some(value => logs.includes(value)), "runtime logs must omit database passwords and session secrets");
  pass("runtime service logs omit generated credentials and session secrets");
  success = true;
} catch (error) {
  appendFileSync(log, `\n${error.message}\n`);
  console.error("FAIL: OPS-04 verification failed; inspect the private local log.");
  process.exitCode = 1;
} finally {
  let cleaned = true;
  if (started) cleaned = compose(["down", "--volumes", "--remove-orphans"], undefined, {}, true) !== null;
  for (const name of ["application.dsn", "migration.dsn", "owner.password", "empty.env"]) rmSync(path.join(cache, name), { force: true });
  if (!cleaned) { console.error(`FAIL: remove disposable Compose project ${project}; cleanup failed.`); process.exitCode = 1; }
  const version = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).stdout?.trim();
  const result = { task: "TASK-OPS-04", acceptance: "AT17 support; reviewer and handover pending", verifiedAt: new Date().toISOString(),
    version, environment: "isolated Docker Compose / PostgreSQL 17.11 / pilot images / local CA", success: success && cleaned, steps, cleaned };
  mkdirSync(path.join(root, ".cache/ops-04"), { recursive: true });
  writeFileSync(path.join(root, ".cache/ops-04/results.json"), JSON.stringify(result, null, 2));
}
