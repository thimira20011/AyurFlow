import { expect, test, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const origin = "https://localhost:3443";
const cache = path.resolve("../.cache/auth-e2e");
let fixture: { accounts: Record<string, string>; password: string; prefix: string };
const canaries: string[] = [];
test.beforeAll(() => {
  fixture = JSON.parse(readFileSync(path.join(cache, "fixture.json"), "utf8"));
});
test.beforeEach(() => { canaries.splice(0, canaries.length, fixture.password, "synthetic-wrong-password", `Synthetic-note-canary-${fixture.prefix}`); });

function readAudits(): string {
  try {
    const connection = new URL(process.env.AUTH_E2E_DATABASE_URL!);
    return execFileSync("psql", ["-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", "SELECT coalesce(json_agg(audit_events), '[]'::json)::text FROM audit_events"], {
      env: { ...process.env, PGHOST: connection.hostname, PGPORT: connection.port || "5432",
        PGDATABASE: decodeURIComponent(connection.pathname.slice(1)), PGUSER: decodeURIComponent(connection.username),
        PGPASSWORD: decodeURIComponent(connection.password), PGSSLMODE: connection.searchParams.get("sslmode") ?? "prefer" },
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    });
  } catch { throw new Error("Private audit inspection failed; no database contents are printed."); }
}
test.afterEach(() => {
  const output = readFileSync(path.join(cache, "services.log"), "utf8") + readAudits();
  expect(canaries.length).toBeGreaterThanOrEqual(2);
  expect(canaries.some(value => output.includes(value))).toBe(false);
});

async function login(api: APIRequestContext, role: string) {
  const response = await api.post("/api/v1/auth/login", {
    headers: { Origin: origin }, data: { loginIdentifier: fixture.accounts[role], password: fixture.password },
  });
  expect(response.status()).toBe(200);
  const session = await response.json();
  canaries.push(session.csrfToken);
  return session as { staffId: string; roles: string[]; csrfToken: string; expiresAt: string };
}
async function csrf(api: APIRequestContext) {
  const response = await api.get("/api/v1/auth/session");
  expect(response.status()).toBe(200);
  const session = await response.json();
  canaries.push(session.csrfToken);
  return { Origin: origin, "X-CSRF-Token": session.csrfToken as string };
}
async function signIn(page: Page, role: string) {
  await page.goto("/sign-in");
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeEnabled();
  await page.getByLabel("Login identifier", { exact: true }).fill(fixture.accounts[role]);
  await page.getByLabel("Password", { exact: true }).fill(fixture.password);
  const submitted = page.waitForResponse(response => response.url() === `${origin}/api/v1/auth/login` && response.request().method() === "POST");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const response = await submitted;
  expect(response.status()).toBe(200);
  canaries.push((await response.json()).csrfToken);
  const setCookie = (await response.allHeaders())["set-cookie"] ?? "";
  expect(setCookie.startsWith("__Host-ayurflow_session=") && /; Secure/i.test(setCookie) && /; HttpOnly/i.test(setCookie) && /; SameSite=Lax/i.test(setCookie) && /; Path=\//i.test(setCookie) && !/; Domain=/i.test(setCookie)).toBe(true);
  await expect(page).toHaveURL(`${origin}/workspace`);
  await expect(page.getByRole("heading", { name: "Staff workspace" })).toBeVisible();
}
async function sessionCookie(context: BrowserContext) {
  const cookie = (await context.cookies()).find(cookie => cookie.name === "__Host-ayurflow_session");
  expect(Boolean(cookie)).toBe(true);
  canaries.push(cookie!.value);
  return cookie!;
}

test("anonymous browser and direct API requests reveal no protected data", async ({ page, request }) => {
  for (const resource of ["/patients", "/admin/staff"]) expect((await request.get(`/api/v1${resource}`)).status()).toBe(401);
  await page.goto("/administration");
  await expect(page).toHaveURL(`${origin}/sign-in`);
});

for (const role of ["administrator", "receptionist", "clinician", "therapist", "dispensary", "billing", "report_reader"]) {
  test(`${role}: real browser sign-in, role boundaries, refresh and logout revocation`, async ({ page, context, playwright }) => {
    await signIn(page, role);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Staff workspace" })).toBeVisible();
    const cookie = await sessionCookie(context);
    expect(cookie.secure && cookie.httpOnly && cookie.sameSite === "Lax" && cookie.path === "/").toBe(true);
    expect(cookie.domain).toBe("localhost");
    expect(await page.evaluate(() => document.cookie.includes("__Host-ayurflow_session"))).toBe(false);
    expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
    expect(page.url().includes(fixture.password)).toBe(false);
    const session = await page.request.get("/api/v1/auth/session");
    expect(session.headers()["cache-control"]).toBe("no-store");
    const restored = await session.json();
    canaries.push(restored.csrfToken);
    expect(restored.roles).toEqual([role]);
    expect((await page.request.get("/api/v1/admin/staff")).status()).toBe(role === "administrator" ? 200 : 403);
    expect((await page.request.get("/api/v1/patients?q=Synthetic")).status()).toBe(role === "receptionist" ? 200 : 403);
    if (role !== "administrator") await expect(page.getByRole("link", { name: "Staff administration", exact: true })).toHaveCount(0);
    await page.locator("header").getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL(`${origin}/sign-in`);
    const replay = await playwright.request.newContext({ baseURL: origin, ignoreHTTPSErrors: true, extraHTTPHeaders: { Cookie: `${cookie.name}=${cookie.value}` } });
    try { expect((await replay.get("/api/v1/admin/staff")).status()).toBe(401); } finally { await replay.dispose(); }
  });
}

test("CSRF rotation and foreign origins reject writes without creating staff", async ({ request }) => {
  expect((await request.post("/api/v1/auth/login", { headers: { Origin: "https://foreign.invalid" }, data: { loginIdentifier: fixture.accounts.administrator, password: fixture.password } })).status()).toBe(403);
  await login(request, "administrator");
  const stale = await csrf(request);
  const fresh = await csrf(request);
  const data = { loginIdentifier: `${fixture.prefix}-csrf`, password: fixture.password, roles: ["billing"] };
  for (const headers of [{ Origin: origin }, stale, { ...fresh, Origin: "https://foreign.invalid" }]) {
    expect((await request.post("/api/v1/admin/staff", { headers, data })).status()).toBe(403);
  }
  const before = await request.get("/api/v1/admin/staff");
  expect((await before.json()).items.some((item: { loginIdentifier: string }) => item.loginIdentifier === data.loginIdentifier)).toBe(false);
  expect((await request.post("/api/v1/admin/staff", { headers: fresh, data })).status()).toBe(201);
});

test("real staff dialog creates an account; role changes and disable revoke its browser session", async ({ browser, page }) => {
  await signIn(page, "administrator");
  await page.goto("/administration");
  await page.getByRole("button", { name: "+ Create staff account", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const identifier = `${fixture.prefix}-managed`;
  await dialog.getByLabel("Login identifier *", { exact: true }).fill(identifier);
  await dialog.getByLabel("Initial password *", { exact: true }).fill(fixture.password);
  await dialog.getByLabel("Billing staff", { exact: true }).check();
  await dialog.getByRole("button", { name: "Create staff account", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const items = (await (await page.request.get("/api/v1/admin/staff")).json()).items;
  const target = items.find((item: { loginIdentifier: string }) => item.loginIdentifier === identifier);
  expect(Boolean(target)).toBe(true);
  const managed = await browser.newContext({ baseURL: origin, ignoreHTTPSErrors: true });
  try {
    const targetPage = await managed.newPage();
    fixture.accounts.managed = identifier;
    await signIn(targetPage, "managed");
    await page.getByRole("button", { name: `Manage access for ${identifier}`, exact: true }).click();
    await dialog.getByLabel("Billing staff", { exact: true }).uncheck();
    await dialog.getByLabel("Receptionist", { exact: true }).check();
    await dialog.getByRole("button", { name: "Save roles", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect((await managed.request.get("/api/v1/patients")).status()).toBe(401);
    await targetPage.reload();
    await expect(targetPage).toHaveURL(`${origin}/sign-in`);
    await signIn(targetPage, "managed");
    await page.getByRole("button", { name: `Manage access for ${identifier}`, exact: true }).click();
    page.once("dialog", confirmation => confirmation.accept());
    await dialog.getByRole("button", { name: "Disable account", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect((await managed.request.get("/api/v1/patients")).status()).toBe(401);
    const rejected = await managed.request.post("/api/v1/auth/login", { headers: { Origin: origin }, data: { loginIdentifier: identifier, password: fixture.password } });
    expect(rejected.status()).toBe(401);
    expect((await rejected.json()).error.code).toBe("invalid_credentials");
    const self = await login(page.request, "administrator");
    expect((await page.request.post(`/api/v1/admin/staff/${self.staffId}/disable`, { headers: await csrf(page.request) })).status()).toBe(409);
    expect((await page.request.put(`/api/v1/admin/staff/${self.staffId}/roles`, { headers: await csrf(page.request), data: { roles: ["billing"] } })).status()).toBe(409);
  } finally { await managed.close(); }
});

test("record access requires clinician assignment and administrator cannot read notes", async ({ playwright }) => {
  const reception = await playwright.request.newContext({ baseURL: origin, ignoreHTTPSErrors: true });
  const clinician = await playwright.request.newContext({ baseURL: origin, ignoreHTTPSErrors: true });
  const administrator = await playwright.request.newContext({ baseURL: origin, ignoreHTTPSErrors: true });
  try {
    await login(reception, "receptionist");
    const doctor = await login(clinician, "clinician");
    await login(administrator, "administrator");
    const created = await reception.post("/api/v1/patients", { headers: await csrf(reception), data: { displayName: `Synthetic ${fixture.prefix}`, birthDate: "1990-01-01", gender: "OTHER", phone: "+94770000001" } });
    expect(created.status()).toBe(201);
    const patient = await created.json();
    const route = `/api/v1/patients/${patient.id}/consultations`;
    expect((await clinician.get(route)).status()).toBe(404);
    expect((await administrator.get(route)).status()).toBe(404);
    expect((await administrator.post(`/api/v1/patients/${patient.id}/clinical-assignments`, { headers: await csrf(administrator), data: { clinicianId: doctor.staffId } })).status()).toBe(201);
    const noteCanary = `Synthetic-note-canary-${fixture.prefix}`;
    canaries.push(noteCanary);
    const note = await clinician.post(route, { headers: await csrf(clinician), data: { draftText: noteCanary } });
    expect(note.status()).toBe(201);
    const record = await note.json();
    expect((await clinician.get(`/api/v1/consultations/${record.id}`)).status()).toBe(200);
    expect((await administrator.get(`/api/v1/consultations/${record.id}`)).status()).toBe(404);
    expect((await reception.get(`/api/v1/consultations/${record.id}`)).status()).toBe(404);
    expect((await administrator.delete(`/api/v1/patients/${patient.id}/clinical-assignments/${doctor.staffId}`, { headers: await csrf(administrator) })).status()).toBe(204);
    expect((await clinician.get(`/api/v1/consultations/${record.id}`)).status()).toBe(404);
  } finally { await Promise.all([reception.dispose(), clinician.dispose(), administrator.dispose()]); }
});

test("identifier throttling blocks correct credentials and permits login after test cooldown", async ({ request }) => {
  for (let attempt = 0; attempt < 3; attempt++) {
    const rejected = await request.post("/api/v1/auth/login", { headers: { Origin: origin }, data: { loginIdentifier: fixture.accounts.billing, password: "synthetic-wrong-password" } });
    expect(rejected.status()).toBe(401);
    expect((await rejected.json()).error.code).toBe("invalid_credentials");
  }
  expect((await request.post("/api/v1/auth/login", { headers: { Origin: origin }, data: { loginIdentifier: fixture.accounts.billing, password: fixture.password } })).status()).toBe(401);
  await expect.poll(async () => (await request.post("/api/v1/auth/login", { headers: { Origin: origin }, data: { loginIdentifier: fixture.accounts.billing, password: fixture.password } })).status(), { timeout: 10_000, intervals: [1000] }).toBe(200);
});

test("real idle expiry removes browser content and rejects the old cookie", async ({ page }) => {
  await signIn(page, "receptionist");
  await expect.poll(async () => (await page.request.get("/api/v1/patients")).status(), { timeout: 30_000, intervals: [21_000] }).toBe(401);
  await page.reload();
  await expect(page).toHaveURL(`${origin}/sign-in`);
});

test("real absolute expiry rejects a session despite repeated refreshes", async ({ request }) => {
  const original = await login(request, "therapist");
  await expect.poll(async () => {
    const response = await request.get("/api/v1/auth/session");
    if (response.status() === 200) {
      const current = await response.json();
      expect(Date.parse(current.expiresAt)).toBe(Date.parse(original.expiresAt));
      canaries.push(current.csrfToken);
    }
    return response.status();
  }, { timeout: 70_000, intervals: [2000] }).toBe(401);
});

test("critical audit events exist and controlled logs/audit omit credential and note canaries", async () => {
  const events = JSON.parse(readAudits()) as { action: string }[];
  for (const action of ["staff.created", "staff.roles_changed", "staff.disabled", "patient.created", "consultation.created"]) expect(events.some(event => event.action === action)).toBe(true);
});
