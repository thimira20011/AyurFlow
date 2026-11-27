import { expect, test } from "@playwright/test";

for (const roles of [["report_reader"], ["clinician", "report_reader"]]) {
  test(`report navigation remains read only for ${roles.join(" + ")}`, async ({ page }) => {
    const unexpected: string[] = [];
    await page.route("**/api/v1/**", async route => {
      const path = new URL(route.request().url()).pathname;
      if (path === "/api/v1/auth/session") return route.fulfill({ json: {
        staffId: "synthetic-report-reader", roles, csrfToken: "synthetic-csrf",
        expiresAt: new Date(Date.now() + 120_000).toISOString(),
      } });
      if (path === "/api/v1/reports/billing/outstanding" && route.request().method() === "GET") {
        return route.fulfill({ json: { generatedAt: "2026-11-10T04:00:00Z", rows: [{
          invoiceId: "synthetic-outstanding", patientId: "synthetic-patient", ageDays: 1,
          totalMinor: 450000, paidMinor: 150000, outstandingMinor: 300000,
          issuedAt: "2026-11-09T04:00:00Z",
        }] } });
      }
      unexpected.push(`${route.request().method()} ${path}`);
      return route.fulfill({ status: 403, json: { error: { code: "forbidden" } } });
    });
    await page.goto("/workspace");
    await page.getByRole("region", { name: "Reports workspace" }).getByRole("link", { name: "Outstanding invoices", exact: true }).click();
    await expect(page).toHaveURL(/\/billing$/);
    await expect(page.getByRole("navigation", { name: "Reports navigation" })).toBeVisible();
    await page.getByRole("button", { name: /Refresh/ }).click();
    await expect(page.getByRole("row").filter({ hasText: "synthetic-outstanding" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Open Draft Invoice|Record Payment|Post Payment|Issue Invoice/i })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("navigation", { name: "Reports navigation" })).toBeVisible();
    expect(unexpected).toEqual([]);
  });
}

test("administrator alone cannot enter billing reports", async ({ page }) => {
  await page.route("**/api/v1/**", route => route.fulfill({ json: {
    staffId: "synthetic-admin", roles: ["administrator"], csrfToken: "synthetic-csrf",
    expiresAt: new Date(Date.now() + 120_000).toISOString(),
  } }));
  await page.goto("/billing");
  await expect(page.getByRole("heading", { name: "This record is not available to you." })).toBeVisible();
  await expect(page.getByRole("button", { name: /Refresh/ })).toHaveCount(0);
});

test("the stock report uses server pagination, eligibility and confirmed trace reads", async ({ page }) => {
  const batchID = "91111111-1111-4111-8111-111111111111";
  const unexpected: string[] = [];
  await page.route("**/api/v1/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/v1/auth/session") return route.fulfill({ json: {
      staffId: "synthetic-reader", roles: ["report_reader"], csrfToken: "synthetic-csrf",
      expiresAt: new Date(Date.now() + 120_000).toISOString(),
    } });
    if (route.request().method() === "GET" && url.pathname === "/api/v1/inventory/batches") {
      const filtered = url.searchParams.get("eligibleOnly") === "true";
      const nextPage = url.searchParams.get("cursor") === batchID;
      return route.fulfill({ json: {
        items: filtered ? [] : [{
          id: batchID, batchReference: nextPage ? "SYN-SECOND" : "SYN-FIRST", itemDisplayName: "Synthetic botanical",
          remainingGrams: "95.000", expiresAt: "2099-01-01", eligibility: "blocked",
          blockReason: "Private block reason canary",
        }],
        summary: { eligibleGrams: "0.000", blockedGrams: "95.000", expiredGrams: "0.000", unknownExpiryGrams: "0.000" },
        clinicDate: "2026-11-26", nextCursor: filtered || nextPage ? null : batchID,
      } });
    }
    if (route.request().method() === "GET" && url.pathname === `/api/v1/reports/inventory/traceability/batches/${batchID}`) {
      return route.fulfill({ json: { items: [{
        patientId: "synthetic-patient-id", patientDisplayName: "Synthetic patient", sessionId: "synthetic-session",
        preparationId: "synthetic-preparation", batchId: batchID, batchReference: "SYN-FIRST", quantityGrams: "5.000",
        confirmedAt: "2026-11-26T00:00:00Z",
      }] } });
    }
    unexpected.push(`${route.request().method()} ${url.pathname}`);
    return route.fulfill({ status: 403, json: { error: { code: "forbidden" } } });
  });
  await page.goto("/reports/inventory");
  await expect(page.getByRole("row", { name: /SYN-FIRST/ })).toBeVisible();
  await expect(page.getByText("Private block reason canary")).toHaveCount(0);
  await page.getByRole("button", { name: "Next batch page" }).click();
  await expect(page.getByRole("row", { name: /SYN-SECOND/ })).toBeVisible();
  await page.getByLabel("Eligible batches only").check();
  await expect(page.getByText("No batches match this view.")).toBeVisible();
  await expect(page.getByRole("region", { name: "Stock balances" }).getByText("95.000 g", { exact: true })).toBeVisible();
  await page.getByLabel("Batch ID", { exact: true }).fill(batchID);
  await page.getByRole("button", { name: "Trace confirmed use" }).click();
  await expect(page.getByRole("row", { name: /Synthetic patient.*5\.000 g/ })).toBeVisible();
  expect(unexpected).toEqual([]);
});
