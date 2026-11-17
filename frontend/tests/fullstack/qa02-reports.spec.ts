import { expect, test, type APIRequestContext } from "@playwright/test";
import { readFileSync } from "node:fs";

const origin = "https://localhost:3443";
const reportPath = "/api/v1/reports/billing/outstanding";
const fixtureID = "91111111-1111-4111-8111-111111111111";
const roles = ["administrator", "receptionist", "clinician", "therapist", "dispensary", "billing", "report_reader"];
type Fixture = { accounts: Record<string, string>; password: string; prefix: string };
let fixture: Fixture;
test.beforeAll(() => { fixture = JSON.parse(readFileSync("../.cache/auth-e2e/fixture.json", "utf8")); });

async function login(api: APIRequestContext, role: string) {
  const response = await api.post("/api/v1/auth/login", { headers: { Origin: origin }, data: { loginIdentifier: fixture.accounts[role], password: fixture.password } });
  expect(response.status()).toBe(200);
}
async function csrf(api: APIRequestContext) {
  const response = await api.get("/api/v1/auth/session");
  expect(response.status()).toBe(200);
  return { Origin: origin, "X-CSRF-Token": (await response.json()).csrfToken as string };
}

test("QA-02: real report HTTP boundaries enforce all seven single-role accounts", async ({ playwright, request }) => {
  const endpoints = [reportPath, "/api/v1/inventory/batches", `/api/v1/reports/inventory/traceability/batches/${fixtureID}`, `/api/v1/reports/inventory/traceability/patients/${fixtureID}`];
  for (const endpoint of endpoints) expect((await request.get(endpoint)).status()).toBe(401);
  for (const role of roles) {
    await test.step(role, async () => {
      const api = await playwright.request.newContext({ baseURL: origin, ignoreHTTPSErrors: true });
      try {
        await login(api, role);
        for (let i = 0; i < endpoints.length; i++) {
          const allowed = i === 0 ? ["billing", "report_reader"].includes(role) : ["dispensary", "report_reader"].includes(role);
          const response = await api.get(endpoints[i]);
          expect(response.status()).toBe(allowed ? 200 : 403);
          expect(response.headers()["cache-control"]).toBe("no-store");
          if (!allowed) expect((await response.json()).error.code).toBe("forbidden");
        }
      } finally { await api.dispose(); }
    });
  }
});

test("QA-02: outstanding report exposes only committed permitted fields and reader writes fail", async ({ playwright }) => {
  const reception = await playwright.request.newContext({ baseURL: origin, ignoreHTTPSErrors: true });
  const billing = await playwright.request.newContext({ baseURL: origin, ignoreHTTPSErrors: true });
  const reader = await playwright.request.newContext({ baseURL: origin, ignoreHTTPSErrors: true });
  try {
    await login(reception, "receptionist"); await login(billing, "billing"); await login(reader, "report_reader");
    const patientResponse = await reception.post("/api/v1/patients", { headers: await csrf(reception), data: { displayName: `Synthetic QA02 ${fixture.prefix}`, birthDate: "1990-01-01", gender: "OTHER", phone: "+94770000092", address: "Synthetic-private-address-canary" } });
    expect(patientResponse.status()).toBe(201);
    const patient = await patientResponse.json();
    const invoiceResponse = await billing.post("/api/v1/invoices", { headers: await csrf(billing), data: { patientId: patient.id } });
    expect(invoiceResponse.status()).toBe(201);
    const invoice = await invoiceResponse.json();
    const path = `/api/v1/invoices/${invoice.id}`;
    const rowForInvoice = async () => {
      const response = await reader.get(reportPath);
      expect(response.status()).toBe(200);
      const report = await response.json();
      expect(Object.keys(report).sort()).toEqual(["generatedAt", "rows"]);
      return (report.rows ?? []).find((row: { invoiceId: string }) => row.invoiceId === invoice.id);
    };
    expect(Boolean(await rowForInvoice())).toBe(false);
    expect((await billing.post(`${path}/items`, { headers: await csrf(billing), data: { description: "Synthetic-private-treatment-canary", quantity: 1, unitPriceMinor: 12345 } })).status()).toBe(201);
    expect((await billing.post(`${path}/issue`, { headers: await csrf(billing) })).status()).toBe(200);
    const row = await rowForInvoice();
    expect(Boolean(row)).toBe(true);
    expect(Object.keys(row).sort()).toEqual(["ageDays", "invoiceId", "issuedAt", "outstandingMinor", "paidMinor", "patientId", "totalMinor"]);
    expect(row.patientId === patient.id && row.totalMinor === 12345 && row.paidMinor === 0 && row.outstandingMinor === 12345).toBe(true);
    expect(JSON.stringify(row).includes("canary")).toBe(false);
    for (const endpoint of [path, `${path}/balance`, `${path}/receipts`, `/api/v1/invoices?patientId=${patient.id}`]) {
      expect((await reader.get(endpoint)).status()).toBe(403);
    }
    const hiddenPatient = await reader.get(`/api/v1/patients/${patient.id}`);
    expect(hiddenPatient.status()).toBe(404);
    expect((await hiddenPatient.json()).error.code).toBe("not_found");
    const beforeState = JSON.stringify(await (await billing.get(path)).json());
    const headers = await csrf(reader);
    for (const [endpoint, data] of [
      ["/api/v1/invoices", { patientId: patient.id }],
      [`${path}/items`, { description: "Denied reader line", quantity: 1, unitPriceMinor: 1 }],
      [`${path}/void`, undefined],
      [`${path}/receipts`, { operationId: "92222222-2222-4222-8222-222222222222", amountMinor: 1, paymentMethod: "cash" }],
    ] as const) expect((await reader.post(endpoint, { headers, data })).status()).toBe(403);
    const unchanged = await rowForInvoice();
    expect(unchanged.totalMinor === 12345 && unchanged.outstandingMinor === 12345).toBe(true);
    expect(JSON.stringify(await (await billing.get(path)).json()) === beforeState).toBe(true);
    const invoices = await (await billing.get(`/api/v1/invoices?patientId=${patient.id}`)).json();
    expect(invoices.items.length === 1 && invoices.items[0].id === invoice.id).toBe(true);
    expect((await (await billing.get(`${path}/receipts`)).json()).items.length).toBe(0);
    expect((await billing.post(`${path}/receipts`, { headers: await csrf(billing), data: { operationId: "93333333-3333-4333-8333-333333333333", amountMinor: 12345, paymentMethod: "cash" } })).status()).toBe(201);
    expect(Boolean(await rowForInvoice())).toBe(false);
  } finally { await reception.dispose(); await billing.dispose(); await reader.dispose(); }
});

for (const mixed of [false, true]) {
  test(`QA-02: real ${mixed ? "clinician plus report reader" : "report reader"} navigation remains read only after reload`, async ({ page, context, playwright }) => {
    let identifier = fixture.accounts.report_reader;
    if (mixed) {
      const admin = await playwright.request.newContext({ baseURL: origin, ignoreHTTPSErrors: true });
      try {
        await login(admin, "administrator");
        identifier = `${fixture.prefix}-qa02-mixed`;
        const created = await admin.post("/api/v1/admin/staff", { headers: await csrf(admin), data: { loginIdentifier: identifier, password: fixture.password, roles: ["clinician", "report_reader"] } });
        expect(created.status()).toBe(201);
      } finally { await admin.dispose(); }
    }
    const response = await context.request.post("/api/v1/auth/login", { headers: { Origin: origin }, data: { loginIdentifier: identifier, password: fixture.password } });
    expect(response.status()).toBe(200);
    await page.goto("/workspace");
    await page.getByRole("region", { name: "Billing reports workspace" }).getByRole("link", { name: "Outstanding invoices", exact: true }).click();
    await expect(page).toHaveURL(`${origin}/billing`);
    await expect(page.getByRole("navigation", { name: "Billing reports navigation" })).toBeVisible();
    for (const reload of [false, true]) {
      if (reload) await page.reload();
      const loaded = page.waitForResponse(r => r.url() === `${origin}${reportPath}` && r.request().method() === "GET");
      await page.getByRole("button", { name: /Refresh/ }).click();
      expect((await loaded).status()).toBe(200);
      await expect(page.getByRole("button", { name: /Open Draft Invoice|Record Payment|Post Payment|Issue Invoice/i })).toHaveCount(0);
      await expect(page.getByLabel("Patient code or UUID to load invoices")).toHaveCount(0);
    }
  });
}
