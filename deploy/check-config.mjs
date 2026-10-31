import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync(process.argv[2], "utf8"));
const { backend, frontend, migrate, proxy } = config.services;
assert(backend && frontend && migrate && proxy, "pilot services must exist");
for (const service of [backend, frontend, migrate]) {
  assert(!service.ports?.length, "only the HTTPS proxy may publish ports");
}
assert.deepEqual(proxy.ports.map(port => Number(port.published)).sort((a, b) => a - b), [80, 443]);
assert.deepEqual(backend.secrets.map(secret => secret.source), ["application_database_url"]);
assert.deepEqual(migrate.secrets.map(secret => secret.source), ["migration_database_url"]);
assert(!frontend.secrets?.length && !proxy.secrets?.length, "database secrets stay in Go services");
assert(migrate.profiles.includes("maintenance"), "migrations require an explicit operator action");
assert.equal(backend.environment.AUTH_ENABLED, "true");
assert(backend.environment.AUTH_ALLOWED_ORIGIN.startsWith("https://"));
for (const service of [backend, migrate]) {
  assert(!service.environment.DATABASE_URL, "credentials must not enter Compose environment");
  assert(service.environment.DATABASE_URL_FILE.startsWith("/run/secrets/"));
}
console.log("Pilot exposure and secret-isolation checks passed.");
