import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const origin = "https://localhost:3443";
type Fixture = { accounts: Record<string, string>; password: string; prefix: string };
let fixture: Fixture;

test.beforeAll(() => {
  fixture = JSON.parse(readFileSync(path.resolve("../.cache/auth-e2e/fixture.json"), "utf8"));
});

async function login(api: APIRequestContext, role: string) {
  const response = await api.post("/api/v1/auth/login", {
    headers: { Origin: origin },
    data: { loginIdentifier: fixture.accounts[role], password: fixture.password },
  });
  expect(response.status()).toBe(200);
  return response.json() as Promise<{ staffId: string }>;
}

async function csrf(api: APIRequestContext) {
  const response = await api.get("/api/v1/auth/session");
  expect(response.status()).toBe(200);
  return { Origin: origin, "X-CSRF-Token": (await response.json()).csrfToken as string };
}

async function signIn(page: Page, role: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Login identifier", { exact: true }).fill(fixture.accounts[role]);
  await page.getByLabel("Password", { exact: true }).fill(fixture.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/workspace`);
}

async function createPatient(api: APIRequestContext, suffix: string) {
  const response = await api.post("/api/v1/patients", {
    headers: await csrf(api),
    data: { displayName: `Synthetic ${fixture.prefix} ${suffix}`, birthDate: "1990-01-01", gender: "OTHER", phone: "+94770000001" },
  });
  expect(response.status()).toBe(201);
  return response.json() as Promise<{ id: string; patientCode: string }>;
}

async function assign(api: APIRequestContext, patientId: string, clinicianId: string) {
  const response = await api.post(`/api/v1/patients/${patientId}/clinical-assignments`, {
    headers: await csrf(api), data: { clinicianId },
  });
  expect(response.status()).toBe(201);
}

test("AT02: protected browser registration, Unicode search, correction and postal confirmation", async ({ page, playwright }) => {
  await signIn(page, "receptionist");
  await page.goto("/patients");
  await expect(page.getByRole("heading", { name: "Every visit begins here." })).toBeVisible();
  await page.getByRole("button", { name: "Register patient", exact: true }).first().click();
  const name = `නිමාලි ${fixture.prefix}`;
  await page.locator("#register-name").fill(name);
  await page.locator("#register-birth-date").fill("1992-03-04");
  await page.locator("#register-gender").selectOption("OTHER");
  await page.locator("#register-postal-code").fill("00500");
  const registered = page.waitForResponse(response => response.url().endsWith("/api/v1/patients") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Create patient record" }).click();
  expect((await registered).status()).toBe(201);
  await expect(page.getByRole("status").filter({ hasText: "Patient registered" })).toBeVisible();
  const code = await page.getByText(/^AYUR-PT-\d+$/).first().textContent();
  expect(code).toMatch(/^AYUR-PT-\d+$/);

  await page.locator("#patient-query").fill(name);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByRole("button", { name: new RegExp(name) })).toBeVisible();
  await page.getByRole("button", { name: new RegExp(name) }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await page.getByRole("button", { name: "Edit demographics" }).click();
  await page.locator("#edit-postal-code").fill("00600");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Demographic changes saved" })).toBeVisible();
  await page.getByText("More demographic details").click();
  await expect(page.getByText("00600", { exact: true })).toBeVisible();

  await page.getByText("Confirm identity without NIC or passport").click();
  await page.locator("#match-name").fill(name.toUpperCase());
  await page.locator("#match-birth-date").fill("1992-03-04");
  await page.locator("#match-postal-code").fill("00500");
  await page.getByRole("button", { name: "Confirm exact match" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "No exact three-attribute match" })).toBeVisible();
  await page.locator("#match-postal-code").fill("00600");
  await page.getByRole("button", { name: "Confirm exact match" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Identity confirmed with three attributes" })).toBeVisible();

  const clinician = await playwright.request.newContext({ baseURL: origin, ignoreHTTPSErrors: true });
  try {
    await login(clinician, "clinician");
    expect((await clinician.get(`/api/v1/patients?q=${encodeURIComponent(name)}`)).status()).toBe(403);
  } finally { await clinician.dispose(); }
});

test("AT03: assigned clinician saves, signs and corrects through the browser; other roles cannot read notes", async ({ page, playwright }) => {
  const reception = await playwright.request.newContext({ baseURL: origin, ignoreHTTPSErrors: true });
  const administrator = await playwright.request.newContext({ baseURL: origin, ignoreHTTPSErrors: true });
  const clinician = await playwright.request.newContext({ baseURL: origin, ignoreHTTPSErrors: true });
  try {
    await login(reception, "receptionist");
    await login(administrator, "administrator");
    const doctor = await login(clinician, "clinician");
    const patient = await createPatient(reception, "consultation-browser");
    await assign(administrator, patient.id, doctor.staffId);

    await signIn(page, "clinician");
    await page.goto(`/clinical?patientId=${patient.id}`);
    await page.getByRole("button", { name: "Open patient" }).click();
    await expect(page.getByText("No consultations are available for this patient.", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "New draft" }).click();
    await page.getByLabel("Clinical note").fill("Synthetic original clinical note.");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Draft saved" })).toBeVisible();
    await page.getByLabel("Clinical note").fill("Synthetic revised clinical note.");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Draft saved" })).toBeVisible();
    const detail = page.locator("section[aria-labelledby='consultation-detail-heading']");
    await detail.getByRole("button", { name: "Review and sign" }).click();
    await page.getByRole("group", { name: "Confirm signing" }).getByRole("button", { name: "Confirm signature" }).click();
    await expect(detail.getByRole("heading", { name: "Signed original" })).toBeVisible();
    await expect(detail.getByText("Synthetic revised clinical note.")).toBeVisible();
    await expect(detail.getByLabel("Clinical note")).toHaveCount(0);
    const listed = await clinician.get(`/api/v1/patients/${patient.id}/consultations`);
    const consultationId = (await listed.json()).items[0].id as string;
    expect((await administrator.get(`/api/v1/consultations/${consultationId}`)).status()).toBe(404);
    expect((await reception.get(`/api/v1/consultations/${consultationId}`)).status()).toBe(404);
    expect((await clinician.patch(`/api/v1/consultations/${consultationId}`, {
      headers: await csrf(clinician), data: { version: 3, draftText: "Forbidden overwrite" },
    })).status()).toBe(409);

    await page.getByRole("button", { name: "Add dated correction" }).click();
    await page.getByLabel("Reason").fill("Clarify synthetic observation");
    await page.getByLabel("Correction").fill("Synthetic dated correction.");
    await detail.getByRole("button", { name: "Add dated correction" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Dated correction added" })).toBeVisible();
    await expect(detail.getByText("Synthetic revised clinical note.")).toBeVisible();
    await expect(detail.getByText("Synthetic dated correction.")).toBeVisible();
    const saved = await (await clinician.get(`/api/v1/consultations/${consultationId}`)).json();
    expect(saved.signedText).toBe("Synthetic revised clinical note.");
    expect(saved.addenda[0].reason).toBe("Clarify synthetic observation");
    expect(Date.parse(saved.addenda[0].createdAt)).not.toBeNaN();
  } finally {
    await reception.dispose(); await administrator.dispose(); await clinician.dispose();
  }
});

test("CLN-05: clinician plan timeline, guarded decisions and responsive layout use the real API", async ({ page, playwright }) => {
  const reception = await playwright.request.newContext({ baseURL: origin, ignoreHTTPSErrors: true });
  const administrator = await playwright.request.newContext({ baseURL: origin, ignoreHTTPSErrors: true });
  const clinician = await playwright.request.newContext({ baseURL: origin, ignoreHTTPSErrors: true });
  try {
    await login(reception, "receptionist");
    await login(administrator, "administrator");
    const doctor = await login(clinician, "clinician");
    const patient = await createPatient(reception, "plan-browser");
    await assign(administrator, patient.id, doctor.staffId);
    await signIn(page, "clinician");
    await page.goto(`/clinical/plans?patientId=${patient.id}`);
    await page.getByRole("button", { name: "Open plans" }).click();
    await expect(page.getByText("No plans are recorded for this patient.")).toBeVisible();
    await page.getByRole("button", { name: "Create plan" }).click();
    const detail = page.getByRole("region", { name: "Plan details" });
    await expect(detail.getByRole("heading", { name: "Treatment plan · Not started" })).toBeVisible();
    await expect(detail.getByText("Version 1 · Not started")).toBeVisible();
    const planId = (await (await clinician.get(`/api/v1/patients/${patient.id}/plans`)).json()).items[0].id as string;
    expect((await administrator.get(`/api/v1/plans/${planId}`)).status()).toBe(404);
    await detail.getByRole("button", { name: "Start preparatory stage" }).click();
    await expect(detail.getByRole("heading", { name: "Treatment plan · Preparatory" })).toBeVisible();
    await expect(detail.getByRole("checkbox", { name: "Initial consultation signed" })).toBeVisible();
    await detail.getByRole("checkbox").first().check();
    await detail.getByRole("checkbox").nth(1).check();
    await detail.getByRole("checkbox").nth(2).check();
    await expect(detail.getByRole("button", { name: "Record approval" })).toBeEnabled();
    await detail.getByRole("button", { name: "Record approval" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "required clinical evidence is missing" })).toBeVisible();
    await expect(detail.getByRole("button", { name: "Record approval" })).toHaveCount(0);

    const draft = await clinician.post(`/api/v1/patients/${patient.id}/consultations`, {
      headers: await csrf(clinician), data: { draftText: "Synthetic pre-treatment assessment." },
    });
    expect(draft.status()).toBe(201);
    const consultation = await draft.json();
    expect((await clinician.post(`/api/v1/consultations/${consultation.id}/sign`, {
      headers: await csrf(clinician), data: { version: consultation.version },
    })).status()).toBe(200);
    await page.getByRole("region", { name: "Patient plans" }).getByRole("button").first().click();
    await expect(detail.getByRole("checkbox")).toHaveCount(3);
    for (const box of await detail.getByRole("checkbox").all()) await box.check();
    await expect(detail.getByRole("button", { name: "Record approval" })).toBeEnabled();
    await detail.getByRole("button", { name: "Record approval" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Stage approved" })).toBeVisible();
    await detail.getByRole("button", { name: "Advance stage" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "required clinical evidence is missing" })).toBeVisible();
    await page.getByRole("region", { name: "Patient plans" }).getByRole("button").first().click();
    await detail.getByLabel("Clinical reason").fill("Synthetic clinical pause");
    await detail.getByRole("button", { name: "Hold", exact: true }).click();
    const hold = detail.getByRole("group", { name: "Confirm hold" });
    await expect(hold.getByText("New session starts and stage advancement will stop.", { exact: false })).toBeVisible();
    await hold.getByRole("button", { name: "Confirm hold" }).click();
    await expect(detail.getByText("Held", { exact: true })).toBeVisible();
    await expect(detail.getByText("Synthetic clinical pause")).toBeVisible();
    await detail.getByLabel("Clinical reason").fill("Synthetic reassessment");
    await detail.getByRole("button", { name: "Resume" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Plan resumed" })).toBeVisible();
    await expect(detail.getByText("Active", { exact: true })).toBeVisible();
    await detail.getByLabel("Clinical reason").fill("Synthetic cancellation review");
    await expect(detail.getByRole("button", { name: "Cancel plan" })).toBeEnabled();
    await detail.getByRole("button", { name: "Cancel plan" }).click();
    const cancellation = detail.getByRole("group", { name: "Confirm cancel" });
    await expect(cancellation.getByText("Cancellation is final.", { exact: false })).toBeVisible();
    await cancellation.getByRole("button", { name: "Keep plan" }).click();
    await expect(detail.getByRole("group", { name: "Confirm cancel" })).toHaveCount(0);
    await detail.getByRole("button", { name: "Cancel plan" }).click();
    await cancellation.getByRole("button", { name: "Confirm cancel" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Plan cancelled." })).toBeVisible();
    await page.getByRole("region", { name: "Patient plans" }).getByRole("button").first().click();
    await expect(detail.getByText("Cancelled", { exact: true })).toBeVisible();
    await expect(detail.getByText("Synthetic cancellation review")).toBeVisible();
    await expect(detail.getByRole("button", { name: "Cancel plan" })).toHaveCount(0);
    const cancelledPlan = await clinician.get(`/api/v1/plans/${planId}`);
    expect(cancelledPlan.status()).toBe(200);
    expect((await cancelledPlan.json()).status).toBe("cancelled");

    for (const width of [1366, 1024, 700]) {
      await page.setViewportSize({ width, height: 768 });
      await expect(detail.getByRole("heading", { name: "Treatment plan · Cancelled" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const listBounds = await page.getByRole("region", { name: "Patient plans" }).boundingBox();
      const detailBounds = await detail.boundingBox();
      const pathwayBounds = await detail.getByRole("region", { name: "Treatment pathway" }).boundingBox();
      const decisionBounds = await detail.getByRole("region", { name: "Next clinical decision" }).boundingBox();
      expect(listBounds && detailBounds && pathwayBounds && decisionBounds).toBeTruthy();
      expect(detailBounds!.y).toBeGreaterThan(listBounds!.y);
      if (width < 900) expect(decisionBounds!.y).toBeGreaterThan(pathwayBounds!.y);
      else expect(decisionBounds!.x).toBeGreaterThan(pathwayBounds!.x);
    }
  } finally {
    await reception.dispose(); await administrator.dispose(); await clinician.dispose();
  }
});
