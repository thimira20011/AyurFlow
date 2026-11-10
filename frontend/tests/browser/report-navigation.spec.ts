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
    await page.getByRole("region", { name: "Billing reports workspace" }).getByRole("link", { name: "Outstanding invoices", exact: true }).click();
    await expect(page).toHaveURL(/\/billing$/);
    await expect(page.getByRole("navigation", { name: "Billing reports navigation" })).toBeVisible();
    await page.getByRole("button", { name: /Refresh/ }).click();
    await expect(page.getByRole("row").filter({ hasText: "synthetic-outstanding" })).toBeVisible();
    await expect(page.getByRole("button", { name: /New Invoice|Record Payment|Post Payment|Issue Invoice/i })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("navigation", { name: "Billing reports navigation" })).toBeVisible();
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
