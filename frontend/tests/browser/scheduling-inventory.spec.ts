import { expect, test, type Page } from "@playwright/test";

async function session(page: Page, role: "receptionist" | "dispensary") {
  await page.route("**/api/v1/**", route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/auth/session") return route.fulfill({ json: {
      staffId: "synthetic-staff", roles: [role], csrfToken: "synthetic-csrf",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    } });
    if (path === "/api/v1/rooms") return route.fulfill({ json: { items: [{ id: "room-1", code: "R1", name: "Therapy room 1", active: true }] } });
    if (path === "/api/v1/availability") return route.fulfill({ json: { items: [{
      id: "availability-1", roomId: "room-1", therapistId: null,
      startsAt: "2026-11-10T03:30:00Z", endsAt: "2026-11-10T09:30:00Z",
    }] } });
    if (path === "/api/v1/sessions" || path === "/api/v1/inventory/items") {
      return route.fulfill({ json: { items: [] } });
    }
    if (path === "/api/v1/inventory/batches") return route.fulfill({ json: {
      items: [], clinicDate: "2026-11-09", summary: {
        eligibleGrams: "0.000", blockedGrams: "0.000", expiredGrams: "0.000", unknownExpiryGrams: "0.000",
      },
    } });
    if (path === "/api/v1/recipes") return route.fulfill({ json: { items: [] } });
    return route.fulfill({ status: 403, json: { error: { code: "forbidden" } } });
  });
}

test("reception schedule renders live booking controls without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await session(page, "receptionist");
  await page.goto("/scheduling");
  await expect(page.getByRole("heading", { name: "Booked sessions" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Book a session" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh schedule" })).toBeVisible();
  await page.getByRole("button", { name: "Change window" }).click();
  await expect(page.getByRole("button", { name: "Save availability change" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1024);
});

test("dispensary uses live recipe and trace screens", async ({ page }) => {
  await session(page, "dispensary");
  await page.goto("/inventory");
  await page.getByRole("button", { name: /Recipes/ }).click();
  await expect(page.getByRole("heading", { name: "Flat botanical recipes" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create recipe" })).toBeVisible();
  await expect(page.getByText("TASK-UI-04 Wireframe Preview")).toHaveCount(0);
  await page.getByRole("button", { name: /Traceability/ }).click();
  await expect(page.getByRole("heading", { name: "Confirmed batch traceability" })).toBeVisible();
});
