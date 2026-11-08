import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

test("BILL-05: issue an invoice, record a deposit and reload its receipt history", async ({ page, playwright }) => {
  const fixture = JSON.parse(readFileSync("../.cache/auth-e2e/fixture.json", "utf8"));
  const origin = "https://localhost:3443";
  const reception = await playwright.request.newContext({ baseURL: origin, ignoreHTTPSErrors: true });
  let patientId: string;
  try {
    const login = await reception.post("/api/v1/auth/login", {
      headers: { Origin: origin },
      data: { loginIdentifier: fixture.accounts.receptionist, password: fixture.password },
    });
    expect(login.status()).toBe(200);
    const session = await reception.get("/api/v1/auth/session");
    expect(session.status()).toBe(200);
    const patient = await reception.post("/api/v1/patients", {
      headers: { Origin: origin, "X-CSRF-Token": (await session.json()).csrfToken },
      data: { displayName: "Synthetic Billing Patient", birthDate: "1990-01-01", gender: "OTHER", phone: "+94770000072" },
    });
    expect(patient.status()).toBe(201);
    patientId = (await patient.json()).id;
  } finally {
    await reception.dispose();
  }

  await page.goto("/sign-in");
  await page.getByLabel("Login identifier", { exact: true }).fill(fixture.accounts.billing);
  await page.getByLabel("Password", { exact: true }).fill(fixture.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/workspace`);
  await page.goto("/billing");
  await page.getByRole("button", { name: /Open Draft Invoice/ }).click();
  const draft = page.getByRole("dialog", { name: "Open Draft Invoice" });
  await draft.getByLabel("Patient ID").fill(patientId);
  await draft.getByRole("button", { name: "Create Draft" }).click();

  const invoice = page.getByRole("dialog", { name: /^Invoice / });
  const description = invoice.getByLabel("Treatment description");
  await description.fill("Synthetic treatment");
  await invoice.getByLabel("Unit price (LKR)").fill("10000.25");
  await invoice.getByRole("button", { name: "+ Add", exact: true }).click();
  await expect(invoice.getByRole("cell", { name: "Synthetic treatment", exact: true })).toBeVisible();
  await invoice.getByRole("button", { name: /Issue & Lock Invoice/ }).click();
  await expect(description).toHaveCount(0);
  await invoice.getByRole("button", { name: "Record Payment" }).click();

  const payment = page.getByRole("dialog", { name: "Post Payment Receipt" });
  await payment.getByLabel("Payment Method").selectOption("direct_deposit");
  await payment.getByLabel("Amount (LKR)").fill("4000.10");
  await payment.getByLabel("Payment reference").fill("Synthetic deposit E05");
  await payment.getByRole("button", { name: "Post Receipt" }).click();
  await expect(invoice.getByRole("cell", { name: "Synthetic deposit E05" })).toBeVisible();
  await expect(invoice.getByText(/6,000\.15/)).toBeVisible();

  await page.reload();
  await page.getByLabel("Patient ID to load invoices").fill(patientId);
  await page.getByRole("button", { name: "Load", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: patientId });
  await expect(row.getByText(/6,000\.15/)).toBeVisible();
  await row.getByRole("button", { name: "View" }).click();
  await expect(invoice.getByRole("cell", { name: "Synthetic deposit E05" })).toHaveCount(1);
  await expect(invoice.getByText(/6,000\.15/)).toBeVisible();
});
