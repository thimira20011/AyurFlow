import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const envFile = new URL(existsSync(new URL(".env", root)) ? ".env" : ".env.local", root);
loadEnvFile(envFile);

const command = process.argv[2];
if (!["api", "migrate"].includes(command)) {
  throw new Error("Choose api or migrate.");
}

const key = command === "migrate" ? "AYURFLOW_MIGRATION_DATABASE_URL" : "AYURFLOW_DATABASE_URL";
if (!process.env[key]) {
  throw new Error(`Set ${key} in the local environment file using the restricted database role.`);
}
const env = { ...process.env, DATABASE_URL: process.env[key] };
delete env.DATABASE_URL_FILE;
// The API receives only its application credential.
for (const name of ["DATABASE_URL_UNPOOLED", "AYURFLOW_MIGRATION_DATABASE_URL", "AYURFLOW_DATABASE_URL"]) {
  delete env[name];
}
const child = spawn("go", ["run", `./cmd/${command}`], {
  cwd: fileURLToPath(new URL("backend/", root)), env, stdio: "inherit",
});
child.on("error", () => {
  console.error("Could not start Go. Check the installed Go toolchain.");
  process.exitCode = 1;
});
child.on("exit", code => { process.exitCode = code ?? 1; });
process.on("SIGTERM", () => child.kill("SIGTERM"));
process.on("SIGINT", () => child.kill("SIGINT"));
