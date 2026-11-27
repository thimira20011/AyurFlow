import { expect, test, type Locator, type Page } from "@playwright/test";

const name = "නිමාලි பெரேரா";
const startsAt = "2026-11-10T03:30:00Z";
const endsAt = "2026-11-10T09:30:00Z";
const patientId = "synthetic-patient";
const invoiceId = "18333333-152d-4602-8b7b-c33413727ba1";
const batchId = "91111111-1111-4111-8111-111111111111";
const longReference = "AYUR-" + "B".repeat(145);

async function openAs(page: Page, role: string, path: string) {
  await page.route("**/api/v1/**", async route => {
    const { pathname } = new URL(route.request().url());
    if (route.request().method() !== "GET") throw new Error(`Unexpected mutation: ${pathname}`);
    if (pathname === "/api/v1/auth/session") return route.fulfill({ json: {
      staffId: "synthetic-staff", roles: [role], csrfToken: "synthetic-csrf",
      expiresAt: new Date(Date.now() + 120_000).toISOString(),
    } });
    if (pathname === "/api/v1/rooms") return route.fulfill({ json: {
      items: [{ id: "room-1", code: "R1", name: "Therapy room", active: true }],
    } });
    if (pathname === "/api/v1/availability") return route.fulfill({ json: {
      items: [{ id: "therapist-window", therapistId: "therapist-1", roomId: null, startsAt, endsAt }],
    } });
    if (pathname === "/api/v1/sessions") return route.fulfill({ json: {
      items: role === "therapist" ? [{
        id: "session-1", patientId, roomId: "room-1", therapistId: "therapist-1", startsAt, endsAt, status: "in_progress",
      }] : [],
    } });
    if (pathname === "/api/v1/inventory/batches") return route.fulfill({ json: {
      items: [], clinicDate: "2026-11-10",
      summary: { eligibleGrams: "0.000", blockedGrams: "0.000", expiredGrams: "0.000", unknownExpiryGrams: "0.000" },
    } });
    if (pathname.startsWith("/api/v1/reports/inventory/traceability/")) return route.fulfill({ json: {
      items: [{
        patientDisplayName: name, patientId, batchReference: longReference, batchId: "synthetic-batch",
        preparationId: "synthetic-preparation", sessionId: "synthetic-session", quantityGrams: "1.250", confirmedAt: startsAt,
      }],
    } });
    if (pathname === "/api/v1/reports/billing/outstanding") return route.fulfill({ json: {
      generatedAt: startsAt,
      rows: [{ invoiceId, patientId, issuedAt: startsAt, ageDays: 1, totalMinor: 5000, paidMinor: 0, outstandingMinor: 5000 }],
    } });
    if (pathname === "/api/v1/admin/staff") return route.fulfill({ json: { items: [], roles: [] } });
    return route.fulfill({ json: { items: [] } });
  });
  await page.goto(path);
}

async function expectVisibleFocus(control: Locator) {
  await expect(control).toBeFocused();
  await expect(control).toHaveCSS("outline-style", "solid");
  await expect(control).toHaveCSS("outline-width", "3px");
}

async function expectPageFits(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
}

for (const width of [1366, 1024]) {
  test.describe(`staff accessibility at ${width}×768`, () => {
    test.use({ viewport: { width, height: 768 } });

    test("skip link bypasses reception navigation and booking focuses the invalid end time", async ({ page }) => {
      await openAs(page, "receptionist", "/scheduling");
      await expect(page.getByRole("heading", { name: "Book a session" })).toBeVisible();
      await page.keyboard.press("Tab");
      const skip = page.getByRole("link", { name: "Skip to content" });
      await expectVisibleFocus(skip);
      await page.keyboard.press("Enter");
      await expect(page.locator("[data-skip-target]")).toBeFocused();
      await page.keyboard.press("Tab");
      await expectVisibleFocus(page.getByRole("link", { name: "Find a patient" }));
      const booking = page.getByRole("region", { name: "Book a session" });
      await booking.getByLabel("Patient ID").fill(patientId);
      await booking.getByLabel("Plan ID").fill("synthetic-plan");
      await booking.getByLabel("Stage ID").fill("synthetic-stage");
      await booking.getByRole("combobox", { name: "Room", exact: true }).selectOption("room-1");
      await booking.getByRole("combobox", { name: "Therapist", exact: true }).selectOption("therapist-1");
      await booking.getByLabel("Start · Asia/Colombo").fill("2026-11-10T10:00");
      const end = booking.getByLabel("End · Asia/Colombo");
      await end.fill("2026-11-10T09:00");
      await booking.getByRole("button", { name: "Book session" }).press("Enter");
      await expectVisibleFocus(end);
      await expect(end).toHaveAccessibleDescription("Enter an end time after the start time.");
      await expect(end).toHaveAttribute("aria-invalid", "true");
      await end.fill("2026-11-10T11:00");
      await expect(end).not.toHaveAttribute("aria-invalid", "true");
      await page.getByRole("button", { name: "Change window" }).press("Enter");
      const availabilityEnd = page.getByLabel("Available until · Asia/Colombo");
      await availabilityEnd.fill("2026-11-10T08:00");
      await page.getByRole("button", { name: "Save availability change" }).press("Enter");
      await expectVisibleFocus(availabilityEnd);
      await expect(availabilityEnd).toHaveAccessibleDescription("Enter an end time after the start time.");
      await expectPageFits(page);
    });

    test("therapist delivery controls follow the keyboard order", async ({ page }) => {
      await openAs(page, "therapist", "/scheduling");
      const record = page.getByRole("button", { name: "Record completion" });
      await record.press("Enter");
      await page.keyboard.press("Tab");
      await expectVisibleFocus(page.getByRole("textbox", { name: "Delivery observations" }));
      await page.keyboard.press("Tab");
      await expectVisibleFocus(page.getByRole("button", { name: "Complete session" }));
      await expectPageFits(page);
    });

    test("dispensary trace results show Sinhala and Tamil and scroll by keyboard", async ({ page }, testInfo) => {
      await openAs(page, "dispensary", "/inventory");
      const traceability = page.getByRole("button", { name: /Traceability/ });
      await traceability.press("Enter");
      await expect(traceability).toHaveAttribute("aria-pressed", "true");
      await page.getByRole("textbox", { name: "Batch ID" }).fill(batchId);
      const trace = page.getByRole("button", { name: "Trace confirmed use" });
      await trace.press("Enter");
      const results = page.getByRole("region", { name: "Traceability results" });
      const patient = results.getByRole("cell").filter({ hasText: name });
      await expect(patient).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const cdp = await page.context().newCDPSession(page);
      try {
        await cdp.send("DOM.enable");
        await cdp.send("CSS.enable");
        const { root } = await cdp.send("DOM.getDocument");
        await patient.evaluate(node => node.setAttribute("data-font-check", ""));
        const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: "[data-font-check]" });
        const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
        for (const familyName of ["Noto Sans Sinhala", "Noto Sans Tamil"]) {
          expect(fonts).toContainEqual(expect.objectContaining({ familyName, isCustomFont: true, glyphCount: expect.any(Number) }));
        }
      } finally {
        await cdp.detach();
      }
      await expect(results.getByRole("cell", { name: "1.250 g" })).toBeVisible();
      await trace.press("Tab");
      await expectVisibleFocus(results);
      await expectPageFits(page);
      await page.screenshot({ path: testInfo.outputPath("traceability.png") });
      await expect.poll(() => results.evaluate(node => node.scrollWidth - node.clientWidth)).toBeGreaterThan(0);
      await page.keyboard.press("ArrowRight");
      await expect.poll(() => results.evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
    });

    test("inventory reports keep validation, Unicode trace and keyboard focus visible", async ({ page }) => {
      await openAs(page, "report_reader", "/reports/inventory");
      const batch = page.getByRole("textbox", { name: "Batch ID" });
      const trace = page.getByRole("button", { name: "Trace confirmed use" });
      await batch.fill("invalid");
      await trace.press("Enter");
      const tracePanel = page.getByRole("region", { name: "Confirmed batch traceability" });
      await expect(tracePanel.getByRole("alert")).toHaveText("Enter a valid batch ID.");
      await batch.fill(batchId);
      await trace.press("Enter");
      const results = page.getByRole("region", { name: "Traceability results" });
      await expect(results.getByRole("cell").filter({ hasText: name })).toBeVisible();
      await trace.press("Tab");
      await expectVisibleFocus(results);
      await expectPageFits(page);
    });

    test("billing draft dialog fits, keeps Tab inside and returns focus on Escape", async ({ page }, testInfo) => {
      await openAs(page, "billing", "/billing");
      await expect(page.getByRole("textbox", { name: "Filter by invoice or patient ID" })).toBeVisible();
      const trigger = page.getByRole("button", { name: /Open Draft Invoice/ });
      await trigger.press("Enter");
      const dialog = page.getByRole("dialog", { name: "Open Draft Invoice" });
      await expectVisibleFocus(dialog.getByRole("button", { name: "Close draft form" }));
      await page.keyboard.press("Tab");
      await expectVisibleFocus(dialog.getByRole("textbox", { name: "Patient code or UUID" }));
      for (let step = 0; step < 6; step++) {
        await page.keyboard.press("Tab");
        if (await page.evaluate(() => document.activeElement === document.body)) await page.keyboard.press("Tab");
        await expect.poll(() => dialog.evaluate(node => node.contains(document.activeElement))).toBe(true);
      }
      await expectPageFits(page);
      await page.screenshot({ path: testInfo.outputPath("draft-dialog.png") });
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expectVisibleFocus(trigger);
    });

    test("report reader reaches the labelled report results with the keyboard", async ({ page }) => {
      await openAs(page, "report_reader", "/billing");
      const refresh = page.getByRole("button", { name: /Refresh/ });
      const results = page.getByRole("region", { name: "Outstanding invoice results" });
      await expect(results.getByRole("cell", { name: invoiceId })).toBeVisible();
      await refresh.press("Tab");
      await expectVisibleFocus(results);
      await expectPageFits(page);
    });

    test("administrator can skip navigation to the staff creation dialog", async ({ page }) => {
      await openAs(page, "administrator", "/administration");
      await expect(page.getByRole("heading", { name: "The people behind the care." })).toBeVisible();
      await page.keyboard.press("Tab");
      await expectVisibleFocus(page.getByRole("link", { name: "Skip to content" }));
      await page.keyboard.press("Enter");
      await expect(page.getByRole("region", { name: "Staff administration" })).toBeFocused();
      const create = page.getByRole("button", { name: /Create staff account/ });
      await expect(create).toBeEnabled();
      await page.keyboard.press("Tab");
      await expectVisibleFocus(create);
      await page.keyboard.press("Enter");
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expectVisibleFocus(create);
      await expectPageFits(page);
    });
  });
}
