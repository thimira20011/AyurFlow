import { expect, test, type Page } from "@playwright/test";

test.use({ channel: process.env.AYURFLOW_BROWSER_CHANNEL || undefined });

const patientId = "00000000-0000-4000-8000-000000000101";

async function staffSession(page: Page, role: "receptionist" | "clinician") {
  await page.route("**/api/v1/**", route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/auth/session") return route.fulfill({ json: {
      staffId: "synthetic-staff", roles: [role], csrfToken: "synthetic-csrf",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    } });
    if (path === "/api/v1/patients" && route.request().method() === "POST") {
      const input = route.request().postDataJSON();
      return route.fulfill({ status: 201, json: {
        ...input, id: patientId, patientCode: "AYUR-PT-00001", version: 1,
        createdAt: "2026-11-05T00:00:00Z", updatedAt: "2026-11-05T00:00:00Z",
      } });
    }
    return route.fulfill({ status: 403, json: { error: { code: "forbidden" } } });
  });
}

for (const width of [1366, 1024]) {
  test(`Member B screens fit ${width}×768 and keep visible keyboard focus`, async ({ page }) => {
    await page.setViewportSize({ width, height: 768 });
    await staffSession(page, "receptionist");
    await page.goto("/patients");
    await page.getByLabel("Name, patient code, ID, identity or phone").focus();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Search", exact: true })).toBeFocused();
    const register = page.getByRole("button", { name: "Register patient", exact: true }).first();
    await expect(register).toBeVisible();
    await register.focus();
    await expect(register).toBeFocused();
    expect(await register.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe("none");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Register a patient" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

    await staffSession(page, "clinician");
    for (const path of ["/clinical", "/clinical/plans"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
  });
}

test("patient validation focuses its first error and Unicode survives registration", async ({ page }) => {
  await staffSession(page, "receptionist");
  await page.goto("/patients?action=register");
  await page.getByRole("button", { name: "Create patient record" }).click();
  await expect(page.getByLabel("Patient name", { exact: false })).toBeFocused();
  await expect(page.getByText("Enter the patient’s name.")).toBeVisible();
  const name = "නිමාලි பெரேரா";
  await page.getByLabel("Patient name", { exact: false }).fill(name);
  await page.locator("#register-birth-date").fill("1990-04-12");
  await page.locator("#register-gender").selectOption("FEMALE");
  await page.locator("#register-postal-code").fill("00700");
  await page.getByRole("button", { name: "Create patient record" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByText("Patient registered. The record is ready to review.")).toBeVisible();
});

test("clinical form errors focus the field that needs correction", async ({ page }) => {
  await staffSession(page, "clinician");
  await page.goto("/clinical");
  await page.getByRole("button", { name: "Open patient" }).click();
  await expect(page.getByLabel("Patient ID")).toBeFocused();
  await expect(page.getByRole("alert").filter({ hasText: "valid patient ID" })).toBeVisible();
  await page.goto("/clinical/plans");
  await page.getByLabel("Patient ID").fill("bad-id");
  await page.getByRole("button", { name: "Open plans" }).click();
  await expect(page.getByLabel("Patient ID")).toBeFocused();
  await expect(page.getByRole("alert").filter({ hasText: "valid patient ID" })).toBeVisible();
});
