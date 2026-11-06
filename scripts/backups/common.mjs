import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

export const maximumBytes = 48 * 1024 * 1024;

export function connection(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("Supply a PostgreSQL connection URL through the environment."); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.pathname.slice(1)) {
    throw new Error("A PostgreSQL database name is required.");
  }
  if (url.hostname.includes("-pooler")) throw new Error("Backup and restore require a direct connection.");
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname) && url.searchParams.get("sslmode") !== "verify-full") {
    throw new Error("Remote database connections require sslmode=verify-full.");
  }
  return url;
}

export function fingerprint(url) {
  return createHash("sha256").update(`${url.hostname.toLowerCase()}:${url.port || "5432"}${url.pathname}`).digest("hex");
}

export async function checksum(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

export function command(name, args, databaseURL, stdin = "ignore") {
  const env = { ...process.env };
  for (const key of ["BACKUP_DATABASE_URL", "RESTORE_DATABASE_URL", "DATABASE_URL", "DATABASE_URL_UNPOOLED",
    "AYURFLOW_DATABASE_URL", "AYURFLOW_MIGRATION_DATABASE_URL", "AYURFLOW_BACKUP_DATABASE_URL", "PGPASSWORD", "PGSERVICE", "PGSERVICEFILE", "PGOPTIONS"]) delete env[key];
  for (const key of Object.keys(env)) if (key.startsWith("PG")) delete env[key];
  // libpq reads credentials from its environment, never command arguments.
  if (databaseURL) {
    const url = connection(databaseURL);
    Object.assign(env, { PGHOST: url.hostname, PGPORT: url.port || "5432", PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
      PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGCONNECT_TIMEOUT: "10", PGCLIENTENCODING: "UTF8" });
    if (url.searchParams.get("sslmode") === "verify-full") env.PGSSLROOTCERT = "system";
    const options = { sslmode: "PGSSLMODE", sslrootcert: "PGSSLROOTCERT", channel_binding: "PGCHANNELBINDING", connect_timeout: "PGCONNECT_TIMEOUT" };
    for (const [key, value] of url.searchParams) {
      if (!options[key]) throw new Error("Unsupported libpq connection option. Use the documented direct connection settings.");
      env[options[key]] = value;
    }
  }
  const child = spawn(name, args, { env, stdio: [stdin, "pipe", "pipe"] });
  child.stderr.resume();
  const done = new Promise((resolve, reject) => {
    child.once("error", () => reject(new Error(`Could not start ${name}. Install the documented tools.`)));
    child.once("close", code => code === 0 ? resolve() : reject(new Error(`${name} failed. Check permissions, connectivity and tool versions.`)));
  });
  // Attach immediately because callers may be wiring streams before awaiting.
  done.catch(() => {});
  return { child, done };
}

export async function query(databaseURL, sql) {
  const { child, done } = command("psql", ["-X", "-A", "-t", "-v", "ON_ERROR_STOP=1"], databaseURL, "pipe");
  child.stdin.end(sql + "\n", "utf8");
  let output = "";
  for await (const chunk of child.stdout) output += chunk;
  await done;
  return output.trim();
}
