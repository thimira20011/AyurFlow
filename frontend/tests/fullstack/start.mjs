// Disposable synthetic test environment only; never a pilot deployment command.
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const cache = path.join(root, ".cache/auth-e2e");
const database = new URL(process.env.AUTH_E2E_DATABASE_URL ?? "http://unset");
if (!["postgres:", "postgresql:"].includes(database.protocol) ||
    !["localhost", "127.0.0.1"].includes(database.hostname) || database.pathname !== "/ayurflow_auth_e2e") {
  throw new Error("Set AUTH_E2E_DATABASE_URL to a loopback disposable ayurflow_auth_e2e database.");
}
mkdirSync(cache, { recursive: true, mode: 0o700 });
const log = path.join(cache, "services.log");
writeFileSync(log, "", { mode: 0o600 });
const env = {
  ...process.env, APP_ENV: "development", DATABASE_URL: database.href, DATABASE_URL_FILE: "",
  HTTP_ADDR: "127.0.0.1:8080", AUTH_ENABLED: "true", AUTH_ALLOWED_ORIGIN: "https://localhost:3443",
  // Short explicit test values, never DEC07 production defaults.
  AUTH_IDLE_TIMEOUT: "20s", AUTH_ABSOLUTE_TIMEOUT: "60s", AUTH_ATTEMPT_LIMIT: "3",
  AUTH_ATTEMPT_WINDOW: "30s", AUTH_BLOCK_DURATION: "5s",
};
function run(command, args, extra = {}) {
  const result = spawnSync(command, args, { cwd: path.join(root, "backend"), env: { ...env, ...extra }, encoding: "utf8" });
  appendFileSync(log, (result.stdout ?? "") + (result.stderr ?? ""));
  if (result.status !== 0) throw new Error(`${path.basename(command)} fixture step failed; inspect private local logs.`);
}
const executable = name => path.join(cache, name + (process.platform === "win32" ? ".exe" : ""));
const tables = spawnSync("psql", ["-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c",
  "SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema')"],
{ env: { ...process.env, PGHOST: database.hostname, PGPORT: database.port || "5432",
  PGDATABASE: decodeURIComponent(database.pathname.slice(1)), PGUSER: decodeURIComponent(database.username),
  PGPASSWORD: decodeURIComponent(database.password), PGSSLMODE: database.searchParams.get("sslmode") ?? "prefer" }, encoding: "utf8" });
if (tables.error) throw new Error(`Cannot start psql (${tables.error.code}); install the PostgreSQL client.`);
if (tables.status !== 0) throw new Error("Disposable database connection/inspection failed; check local client and database settings.");
if (tables.stdout.trim() !== "0") throw new Error("AUTH-06 requires an empty disposable database; no existing records are changed.");
for (const name of ["api", "migrate", "seedstaff"]) run("go", ["build", "-o", executable(name), `./cmd/${name}`]);
run(executable("migrate"), []);
const password = `Synthetic-only-${randomBytes(24).toString("hex")}`;
const prefix = `auth-e2e-${randomBytes(4).toString("hex")}`;
const roles = ["administrator", "receptionist", "clinician", "therapist", "dispensary", "billing", "report_reader"];
const accounts = Object.fromEntries(roles.map(role => [role, `${prefix}-${role}`]));
for (const role of roles) run(executable("seedstaff"), [], {
  SEED_STAFF_LOGIN: accounts[role], SEED_STAFF_PASSWORD: password, SEED_STAFF_ROLES: role,
});
// A repeat seed must not replace the original administrator password or roles.
run(executable("seedstaff"), [], { SEED_STAFF_LOGIN: accounts.administrator,
  SEED_STAFF_PASSWORD: `Synthetic-repeat-${randomBytes(24).toString("hex")}`, SEED_STAFF_ROLES: "billing" });
writeFileSync(path.join(cache, "fixture.json"), JSON.stringify({ accounts, password, prefix }), { mode: 0o600 });
run("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-subj", "/CN=localhost",
  "-addext", "subjectAltName=DNS:localhost,IP:127.0.0.1", "-keyout", path.join(cache, "tls.key"), "-out", path.join(cache, "tls.pem")]);

const children = [];
let stopping = false;
function start(command, args, cwd, childEnv = env) {
  const child = spawn(command, args, { cwd, env: childEnv, stdio: ["ignore", "pipe", "pipe"] });
  children.push(child);
  for (const stream of [child.stdout, child.stderr]) stream.on("data", chunk => appendFileSync(log, chunk));
  child.on("error", () => stop(1));
  child.on("exit", () => { if (!stopping) stop(1); });
}
const proxy = https.createServer({ key: readFileSync(path.join(cache, "tls.key")), cert: readFileSync(path.join(cache, "tls.pem")) }, (request, response) => {
  const upstream = http.request({ hostname: "127.0.0.1", port: 3100, path: request.url, method: request.method, headers: request.headers }, result => {
    response.writeHead(result.statusCode, result.headers);
    result.pipe(response);
  });
  upstream.on("error", () => { if (!response.headersSent) response.writeHead(502); response.end(); });
  response.on("close", () => upstream.destroy());
  request.pipe(upstream);
});
function stop(code) {
  if (stopping) return;
  stopping = true;
  proxy.close();
  for (const child of children) child.kill("SIGTERM");
  setTimeout(() => { for (const child of children) if (child.exitCode === null) child.kill("SIGKILL"); process.exit(code); }, 2000).unref();
}
process.on("SIGTERM", () => stop(0));
process.on("SIGINT", () => stop(0));
start(executable("api"), [], root);
const frontendEnv = { ...process.env };
for (const key of ["DATABASE_URL", "DATABASE_URL_FILE", "AUTH_E2E_DATABASE_URL", "SEED_STAFF_PASSWORD"]) delete frontendEnv[key];
start(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3100"], path.join(root, "frontend"), frontendEnv);
proxy.on("error", () => stop(1));
proxy.listen(3443, "localhost");
