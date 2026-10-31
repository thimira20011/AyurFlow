import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { apiGet, apiMutation, APIRequestError, canOpenArea, login } from "../src/lib/api-client.ts";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test("login uses the cookie API and never puts passwords in the URL", async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/v1/auth/login");
    assert.equal(options.method, "POST");
    assert.equal(options.credentials, "same-origin");
    assert.equal(options.cache, "no-store");
    assert.deepEqual(JSON.parse(options.body), { loginIdentifier: "synthetic-staff", password: "synthetic-password" });
    return Response.json({ staffId: "synthetic", roles: ["receptionist"], csrfToken: "synthetic-csrf", expiresAt: "2026-10-27T00:00:00Z" });
  };
  assert.equal((await login("synthetic-staff", "synthetic-password")).roles[0], "receptionist");
});

test("mutations obtain fresh CSRF and handle empty logout responses", async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push(url);
    if (url.endsWith("/auth/session")) return Response.json({ csrfToken: "fresh-synthetic-csrf" });
    assert.equal(url, "/api/v1/auth/logout");
    assert.equal(options.headers["X-CSRF-Token"], "fresh-synthetic-csrf");
    return new Response(null, { status: 204 });
  };
  assert.equal(await apiMutation("/auth/logout"), undefined);
  assert.deepEqual(calls, ["/api/v1/auth/session", "/api/v1/auth/logout"]);
});

test("an ambiguous mutation response is never automatically retried", async () => {
  let writes = 0;
  globalThis.fetch = async (url) => {
    if (url.endsWith("/auth/session")) return Response.json({ csrfToken: "synthetic" });
    writes++;
    throw new TypeError("synthetic network loss");
  };
  await assert.rejects(apiMutation("/admin/staff", { loginIdentifier: "synthetic" }), TypeError);
  assert.equal(writes, 1);
});

test("proxy errors and malformed envelopes produce safe errors", async () => {
  for (const body of ["<html>private proxy failure</html>", "null", '{"error":{}}']) {
    globalThis.fetch = async () => new Response(body, { status: 503 });
    await assert.rejects(apiGet("/auth/session"), error => error instanceof APIRequestError && error.status === 503 && !error.message.includes("private"));
  }
});

test("resource paths stay relative and Unicode queries still work", async () => {
  globalThis.fetch = async (url) => { assert.ok(url.startsWith("/api/v1/")); return Response.json({}); };
  for (const path of ["https://evil.example", "//evil.example", "/../outside", "/bad\\path"]) await assert.rejects(apiGet(path));
  await apiGet("/patients?q=ආයු");
});

test("administrator navigation grants no clinical or patient permission", () => {
  assert.equal(canOpenArea("/administration", ["administrator"]), true);
  assert.equal(canOpenArea("/clinical", ["administrator"]), false);
  assert.equal(canOpenArea("/patients", ["administrator"]), false);
  assert.equal(canOpenArea("/patients/details", ["receptionist"]), true);
  assert.equal(canOpenArea("/clinical", []), false);
});

test("role updates use PUT and send only the explicit role payload with session CSRF", async () => {
  globalThis.fetch = async (url, options) => {
    if (url.endsWith("/auth/session")) return Response.json({ csrfToken: "fresh-role-token" });
    assert.equal(url, "/api/v1/admin/staff/synthetic-id/roles");
    assert.equal(options.method, "PUT");
    assert.equal(options.headers["X-CSRF-Token"], "fresh-role-token");
    assert.deepEqual(JSON.parse(options.body), { roles: ["billing"] });
    return Response.json({ roles: ["billing"] });
  };
  await apiMutation("/admin/staff/synthetic-id/roles", { roles: ["billing"] }, "PUT");
});
