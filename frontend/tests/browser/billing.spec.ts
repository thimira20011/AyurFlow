import { expect, test } from "@playwright/test";

const patientId = "30ad6d29-79b0-4028-93c4-614df48ec3ea";
const invoiceId = "18333333-152d-4602-8b7b-c33413727ba1";
const timestamp = "2026-11-08T10:00:00Z";

test("draft dialog keeps keyboard focus inside and restores focus on Escape", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.route("**/api/v1/auth/session", route => route.fulfill({ json: {
    staffId: "synthetic", roles: ["billing"], csrfToken: "synthetic-csrf",
    expiresAt: new Date(Date.now() + 120_000).toISOString(),
  } }));
  await page.goto("/billing");
  const openDraft = page.getByRole("button", { name: "Open Draft Invoice" });
  await openDraft.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Open Draft Invoice" });
  const close = dialog.getByRole("button", { name: "Close draft form" });
  const patient = dialog.getByRole("textbox", { name: "Patient ID" });
  await expect(close).toBeFocused();
  await expect(patient).toHaveAccessibleDescription("The invoice will be opened in draft status. Add treatment line items before issuing.");
  await page.keyboard.press("Tab");
  await expect(patient).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(openDraft).toBeFocused();
});

test("receipt retry preserves the original payment and reload shows the saved balance", async ({ page }) => {
  const invoice = { id: invoiceId, patientId, status: "issued", totalMinor: 1000025, issuedAt: timestamp, createdAt: timestamp };
  const session = {
    staffId: "synthetic", roles: ["billing"], csrfToken: "synthetic-csrf",
    expiresAt: new Date(Date.now() + 120_000).toISOString(),
  };
  const attempts: unknown[] = [];
  let stored: object | null = null;
  await page.route("**/api/v1/**", async route => {
    const { pathname } = new URL(route.request().url());
    if (pathname.endsWith("/auth/session")) return route.fulfill({ json: session });
    if (pathname.endsWith("/invoices")) return route.fulfill({ json: { items: [invoice] } });
    if (pathname.endsWith(invoiceId)) return route.fulfill({ json: invoice });
    if (pathname.endsWith("/receipts")) {
      if (route.request().method() === "GET") return route.fulfill({ json: { items: stored ? [stored] : null } });
      expect(route.request().headers()["x-csrf-token"]).toBe("synthetic-csrf");
      const input = route.request().postDataJSON();
      attempts.push(input);
      if (!stored) {
        stored = { ...input, id: "synthetic-receipt", invoiceId, issuedAt: timestamp };
        return route.abort("failed"); // The receipt committed but its response was lost.
      }
      return route.fulfill({ json: stored });
    }
    return route.fulfill({ status: 404, json: { error: { code: "not_found" } } });
  });

  async function loadInvoice() {
    await page.getByLabel("Patient ID to load invoices").fill(patientId);
    await page.getByRole("button", { name: "Load", exact: true }).click();
    return page.getByRole("row").filter({ hasText: invoiceId });
  }

  await page.goto("/billing");
  const row = await loadInvoice();
  await row.getByRole("button", { name: "View" }).click();
  await page.getByRole("button", { name: "Record Payment" }).click();
  const form = page.getByRole("dialog", { name: "Post Payment Receipt" });
  await form.getByLabel("Payment Method").selectOption("direct_deposit");
  await form.getByLabel("Payment reference").fill("Synthetic deposit");
  await form.getByLabel("Amount (LKR)").fill("4000.105");
  await form.getByRole("button", { name: "Post Receipt" }).click();
  await expect(form.getByRole("alert")).toContainText("at most two decimal places");
  expect(attempts).toHaveLength(0);
  await form.getByLabel("Amount (LKR)").fill("4000.10");
  await form.getByRole("button", { name: "Post Receipt" }).click();
  await expect(form.getByRole("alert")).toContainText("Receipt not confirmed");
  await expect(form.getByLabel("Amount (LKR)")).toHaveAttribute("readonly", "");
  await form.getByRole("button", { name: "Retry Receipt" }).click();
  await expect(page.getByRole("cell", { name: "Synthetic deposit" })).toHaveCount(1);
  expect(attempts).toHaveLength(2);
  expect(attempts[0]).toEqual({ operationId: expect.any(String), amountMinor: 400010, paymentMethod: "direct_deposit", label: "Synthetic deposit" });
  expect(attempts[1]).toEqual(attempts[0]);

  await page.reload();
  const reloaded = await loadInvoice();
  await expect(reloaded.getByText(/6,000\.15/)).toBeVisible();
  await reloaded.getByRole("button", { name: "View" }).click();
  await expect(page.getByRole("cell", { name: "Synthetic deposit" })).toHaveCount(1);
});
