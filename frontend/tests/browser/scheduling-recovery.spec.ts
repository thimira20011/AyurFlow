import { expect, test, type Page } from "@playwright/test";

async function scheduleFixture(page: Page) {
  const state = { fail: false, empty: false, pause: false, slowDate: "", writes: 0, reads: 0, failAfterWrite: false, abortWrite: false, conflict: false };
  let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  let pending = 0;
  const saved: Record<string, unknown>[] = [];
  await page.route("**/api/v1/**", async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path === "/api/v1/auth/session") return route.fulfill({ json: {
      staffId: "synthetic-staff", roles: ["receptionist"], csrfToken: "synthetic-csrf",
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    } });
    if (path === "/api/v1/sessions" && route.request().method() === "POST") {
      state.writes++;
      if (state.conflict) return route.fulfill({ status: 409, json: { error: { code: "conflict" } } });
      saved.push({ ...route.request().postDataJSON(), id: "saved-session", status: "booked", version: 1, observations: null, cancellationReason: null });
      if (state.failAfterWrite) state.fail = true;
      if (state.abortWrite) return route.abort("failed");
      return route.fulfill({ status: 201, json: saved[0] });
    }
    if (!["/api/v1/rooms", "/api/v1/availability", "/api/v1/sessions"].includes(path)) return route.fulfill({ status: 404, json: {} });
    state.reads++;
    const start = url.searchParams.get("start");
    const day = start ? new Date(Date.parse(start) + 19_800_000).toISOString().slice(0, 10) : "";
    const paused = state.pause || Boolean(state.slowDate && day === state.slowDate);
    if (paused) { pending++; await gate; }
    const reply = async () => {
      if (path === "/api/v1/rooms") return route.fulfill({ json: { items: [{ id: "room-1", code: "R1", name: "Therapy room 1", active: true }] } });
      if (path === "/api/v1/availability") {
        if (state.fail) return route.fulfill({ status: 503, json: { error: { code: "unavailable" } } });
        return route.fulfill({ json: { items: state.empty ? null : [
          { id: "room-window", roomId: "room-1", therapistId: null, startsAt: `${day}T03:30:00Z`, endsAt: `${day}T09:30:00Z` },
          { id: "therapist-window", roomId: null, therapistId: "therapist-1", startsAt: `${day}T03:30:00Z`, endsAt: `${day}T09:30:00Z` },
        ] } });
      }
      return route.fulfill({ json: { items: state.empty ? null : [...saved, {
        id: `session-${day}`, patientId: `synthetic-${day}`, planId: "plan-1", stageId: "stage-1", roomId: "room-1", therapistId: "therapist-1",
        startsAt: `${day}T03:30:00Z`, endsAt: `${day}T04:30:00Z`, status: "booked", version: 1, observations: null, cancellationReason: null,
      }] } });
    };
    // The obsolete request can be aborted by the date-change cleanup.
    if (paused) await reply().catch(() => {}); else await reply();
  });
  await page.goto("/scheduling");
  await expect(page.getByRole("button", { name: "Book session", exact: true })).toBeEnabled();
  await page.getByLabel("Clinic date").fill("2026-11-27");
  await expect(page.getByText("Patient synthetic-2026-11-27", { exact: true })).toBeVisible();
  return { state, release, pending: () => pending };
}

async function fillBooking(page: Page) {
  const booking = page.getByRole("group", { name: "Session booking", exact: true });
  await booking.getByLabel("Patient ID", { exact: true }).fill("synthetic-draft-patient");
  await booking.getByLabel("Plan ID", { exact: true }).fill("synthetic-plan");
  await booking.getByLabel("Stage ID", { exact: true }).fill("synthetic-stage");
  await booking.getByRole("combobox", { name: "Room", exact: true }).selectOption("room-1");
  await booking.getByRole("combobox", { name: "Therapist", exact: true }).selectOption("therapist-1");
  await booking.getByLabel("Start · Asia/Colombo", { exact: true }).fill("2026-11-27T11:00");
  await booking.getByLabel("End · Asia/Colombo", { exact: true }).fill("2026-11-27T12:00");
  return booking;
}

for (const width of [1366, 1024]) {
  test(`schedule loading, failure and keyboard retry preserve selections at ${width}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 768 });
    const fixture = await scheduleFixture(page);
    const booking = await fillBooking(page);
    fixture.state.pause = true;
    await page.getByRole("button", { name: "Refresh schedule" }).click();
    await expect(page.getByRole("heading", { name: "Loading this date’s schedule…" })).toBeVisible();
    await expect(page.getByText("Patient synthetic-2026-11-27", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Change window" })).toHaveCount(0);
    await expect(booking.getByLabel("Patient ID", { exact: true })).toBeDisabled();
    fixture.state.fail = true;
    fixture.release();
    await expect(page.getByRole("heading", { name: "We couldn’t load this date" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "No sessions yet" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Load availability first" })).toBeDisabled();
    await expect(booking.getByLabel("Patient ID", { exact: true })).toHaveValue("synthetic-draft-patient");
    await booking.evaluate(fieldset => fieldset.closest("form")?.requestSubmit());
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: testInfo.outputPath(`schedule-recovery-${width}.png`), fullPage: true });
    fixture.state.fail = false;
    const retry = page.getByRole("button", { name: "Retry loading schedule" });
    await retry.focus(); await page.keyboard.press("Enter");
    await expect(page.getByText("Patient synthetic-2026-11-27", { exact: true })).toBeVisible();
    await expect(booking.getByLabel("Patient ID", { exact: true })).toHaveValue("synthetic-draft-patient");
    await expect(booking.getByRole("combobox", { name: "Room", exact: true })).toHaveValue("room-1");
    await expect(booking.getByRole("combobox", { name: "Therapist", exact: true })).toHaveValue("therapist-1");
    await expect(booking.getByLabel("Start · Asia/Colombo", { exact: true })).toHaveValue("2026-11-27T11:00");
    await expect(page.getByRole("button", { name: "Book session", exact: true })).toBeEnabled();
    expect(fixture.state.writes).toBe(0);
  });
}

test("a rejected booking conflict requires a fresh read without repeating the write", async ({ page }) => {
  const fixture = await scheduleFixture(page);
  const booking = await fillBooking(page);
  fixture.state.conflict = true;
  await page.getByRole("button", { name: "Book session", exact: true }).click();
  await expect(page.getByRole("heading", { name: "We couldn’t load this date" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Load availability first" })).toBeDisabled();
  await expect(page.getByText("The action may have completed. Reload before trying again.", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Retry loading schedule" }).click();
  await expect(page.getByRole("button", { name: "Book session", exact: true })).toBeEnabled();
  await expect(booking.getByLabel("Patient ID", { exact: true })).toHaveValue("synthetic-draft-patient");
  expect(fixture.state.writes).toBe(1);
  await expect(page.getByText("Patient synthetic-draft-patient", { exact: true })).toHaveCount(0);
});

test("a delayed earlier date cannot replace the latest selected date", async ({ page }) => {
  const fixture = await scheduleFixture(page);
  fixture.state.slowDate = "2026-11-28";
  await page.getByLabel("Clinic date").fill("2026-11-28");
  await expect.poll(fixture.pending).toBe(2);
  await page.getByLabel("Clinic date").fill("2026-11-29");
  await expect(page.getByText("Patient synthetic-2026-11-29", { exact: true })).toBeVisible();
  fixture.release();
  await page.getByRole("button", { name: "Refresh schedule" }).click();
  await expect(page.getByText("Patient synthetic-2026-11-29", { exact: true })).toBeVisible();
  await expect(page.getByText("Patient synthetic-2026-11-28", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Clinic date")).toHaveValue("2026-11-29");
});

test("a successful empty day and a cleared date have distinct recoverable states", async ({ page }) => {
  const fixture = await scheduleFixture(page);
  fixture.state.empty = true;
  await page.getByRole("button", { name: "Refresh schedule" }).click();
  await expect(page.getByRole("heading", { name: "No sessions yet" })).toBeVisible();
  await expect(page.getByText("No availability windows are recorded.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Choose another date" }).click();
  await expect(page.getByLabel("Clinic date")).toBeFocused();
  const reads = fixture.state.reads;
  await page.getByLabel("Clinic date").fill("");
  await expect(page.getByText("Choose a valid clinic date, then retry loading the schedule.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Load availability first" })).toBeDisabled();
  expect(fixture.state.reads).toBe(reads);
  await page.getByLabel("Clinic date").fill("2026-11-28");
  await expect(page.getByRole("heading", { name: "No sessions yet" })).toBeVisible();
});

for (const outcome of ["saved_refresh_failed", "response_lost"] as const) {
  test(`read-only recovery does not resubmit a booking after ${outcome}`, async ({ page }) => {
    const fixture = await scheduleFixture(page);
    await fillBooking(page);
    fixture.state.failAfterWrite = outcome === "saved_refresh_failed";
    fixture.state.abortWrite = outcome === "response_lost";
    await page.getByRole("button", { name: "Book session", exact: true }).click();
    await expect(page.getByRole("heading", { name: "We couldn’t load this date" })).toBeVisible();
    await expect(page.getByText("The action may have completed. Reload before trying again.", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Load availability first" })).toBeDisabled();
    await expect(page.getByText("No booking has been submitted.", { exact: true })).toHaveCount(0);
    expect(fixture.state.writes).toBe(1);
    fixture.state.fail = false;
    await page.getByRole("button", { name: "Retry loading schedule" }).click();
    await expect(page.getByText("Patient synthetic-draft-patient", { exact: true })).toBeVisible();
    expect(fixture.state.writes).toBe(1);
  });
}
