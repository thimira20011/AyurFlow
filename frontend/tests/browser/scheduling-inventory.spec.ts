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
    }, {
      id: "availability-2", roomId: null, therapistId: "synthetic-therapist",
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
  await page.getByRole("listitem").filter({ hasText: "Therapy room 1" }).getByRole("button", { name: "Change window" }).click();
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
  const trace = page.getByRole("region", { name: "Batch traceability results" });
  await page.getByRole("button", { name: "Trace confirmed use" }).press("Tab");
  await expect(trace).toBeFocused();
  await expect(trace.getByRole("columnheader", { name: "Actual quantity" })).toBeVisible();
});

test("schedule distinguishes loading, an empty response and a failed refresh", async ({ page }) => {
  await session(page, "receptionist");
  let release!: () => void;
  const response = new Promise<void>(resolve => { release = resolve; });
  let failed = false;
  await page.route("**/api/v1/sessions?*", async route => {
    await response;
    return failed
      ? route.fulfill({ status: 500, json: { error: { code: "internal_error" } } })
      : route.fulfill({ json: { items: [] } });
  });
  await page.goto("/scheduling");
  const panel = page.getByRole("region", { name: "Booked sessions" });
  await expect(panel.getByRole("status")).toHaveText("Loading the schedule…");
  release();
  await expect(panel.getByRole("status")).toHaveText("No sessions are recorded for this date.");
  failed = true;
  await page.getByRole("button", { name: "Refresh schedule" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "The scheduling service could not confirm this action." })).toBeVisible();
  await expect(panel.getByRole("status")).toHaveCount(0);
});

test("booking time error is announced and linked to the end-time field", async ({ page }) => {
  await session(page, "receptionist");
  let submitted = 0;
  await page.route("**/api/v1/sessions", async route => {
    if (route.request().method() !== "POST") return route.fallback();
    submitted++;
    return route.fulfill({ status: 201, json: {} });
  });
  await page.goto("/scheduling");
  const booking = page.getByRole("region", { name: "Book a session" });
  await booking.getByLabel("Patient ID").fill("synthetic-patient");
  await booking.getByLabel("Plan ID").fill("synthetic-plan");
  await booking.getByLabel("Stage ID").fill("synthetic-stage");
  await booking.getByLabel("Room", { exact: true }).selectOption("room-1");
  await booking.getByLabel("Therapist", { exact: true }).selectOption("synthetic-therapist");
  await booking.getByLabel("Start · Asia/Colombo").fill("2026-11-10T10:00");
  const end = booking.getByLabel("End · Asia/Colombo");
  await end.fill("2026-11-10T09:00");
  await booking.getByRole("button", { name: "Book session" }).click();
  await expect(booking.getByRole("alert")).toHaveText("Enter a valid start and end time in Asia/Colombo.");
  await expect(end).toHaveAccessibleDescription("Enter a valid start and end time in Asia/Colombo.");
  await expect(end).toHaveAttribute("aria-invalid", "true");
  expect(submitted).toBe(0);
  await end.fill("2026-11-10T11:00");
  await expect(booking.getByRole("alert")).toHaveCount(0);
  await expect(end).not.toHaveAttribute("aria-invalid", "true");
  await booking.getByRole("button", { name: "Book session" }).click();
  await expect(page.getByText("Session booked.", { exact: true })).toBeVisible();
  expect(submitted).toBe(1);
});
