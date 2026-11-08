import { cpSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";

// Standalone builds omit public assets and static chunks by default.
const server = ".next/standalone/server.js";
if (!existsSync(server)) throw new Error("Run npm run build before browser tests.");
cpSync("public", ".next/standalone/public", { recursive: true });
cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
const child = spawn(process.execPath, [server], {
  stdio: "inherit",
  env: { ...process.env, HOSTNAME: "127.0.0.1", PORT: "3100" },
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("error", error => { console.error(error); process.exit(1); });
child.on("exit", code => process.exit(code ?? 1));
