import { expect, test, type Page } from "@playwright/test";

// Synthetic responses exercise the real rendered UI, not backend acceptance.
async function authAPI(page: Page, roles = ["receptionist"], authenticated = true) {
  const state = { authenticated, lookupStatus: 200, logoutStatus: 204, logins: 0, logouts: 0 };
  await page.route("**/api/v1/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const session = {
      staffId: "synthetic-staff", roles, csrfToken: "synthetic-fresh-csrf",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
    if (path === "/api/v1/auth/login") {
      state.logins++;
      expect(request.method()).toBe("POST");
      expect(request.postDataJSON()).toEqual({ loginIdentifier: "synthetic-staff", password: "synthetic-password" });
      state.authenticated = true;
      return route.fulfill({ json: session });
    }
    if (path === "/api/v1/auth/session") {
      const status = state.lookupStatus !== 200 ? state.lookupStatus : state.authenticated ? 200 : 401;
      return route.fulfill({ status, json: status === 200 ? session : { error: { code: "unavailable" } } });
    }
    if (path === "/api/v1/auth/logout") {
      state.logouts++;
      expect(request.method()).toBe("POST");
      expect(request.headers()["x-csrf-token"]).toBe("synthetic-fresh-csrf");
      if (state.logoutStatus === 204) state.authenticated = false;
      return route.fulfill({ status: state.logoutStatus, body: "" });
    }
    return route.fulfill({ status: 403, json: { error: { code: "forbidden" } } });
  });
  return state;
}

for (const path of ["/reception", "/dashboard", "/patients", "/administration"]) {
  test(`anonymous access to ${path} requires sign-in`, async ({ page }) => {
    await authAPI(page, [], false);
    await page.goto(path);
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.getByRole("navigation", { name: "Staff session" })).toHaveCount(0);
  });
}

test("session service failure on localhost never creates a demo session", async ({ page }) => {
  const state = await authAPI(page, [], false);
  state.lookupStatus = 503;
  await page.goto("/reception");
  await expect(page.getByText("Session lookup is unavailable. Retry when the service is ready.")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Staff session" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Register patient", exact: true })).toHaveCount(0);
});

test("the styled sign-in form submits credentials to the API before opening the workspace", async ({ page }) => {
  const state = await authAPI(page, ["receptionist"], false);
  await page.goto("/sign-in");
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeEnabled();
  await expect(page.locator("#sign-in-form")).toHaveAttribute("method", "post");
  await page.getByLabel("Login identifier", { exact: true }).fill("synthetic-staff");
  await page.getByLabel("Password", { exact: true }).fill("synthetic-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace$/);
  expect(state.logins).toBe(1);
  expect(page.url()).not.toContain("synthetic-password");
  await expect(page.getByRole("link", { name: "Reception desk", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Staff administration", exact: true })).toHaveCount(0);
});

test("invalid credentials stay on sign-in and display a focused error", async ({ page }) => {
  await authAPI(page, [], false);
  await page.route("**/api/v1/auth/login", route => route.fulfill({
    status: 401, json: { error: { code: "invalid_credentials" } },
  }));
  await page.goto("/sign-in");
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeEnabled();
  await page.getByLabel("Login identifier", { exact: true }).fill("synthetic-staff");
  await page.getByLabel("Password", { exact: true }).fill("synthetic-wrong-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const error = page.getByRole("alert").filter({ hasText: "incorrect" });
  await expect(error).toBeVisible();
  await expect(error).toBeFocused();
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("a receptionist cannot open staff administration", async ({ page }) => {
  await authAPI(page);
  await page.goto("/administration");
  await expect(page.getByRole("heading", { name: "This record is not available to you." })).toBeVisible();
  await expect(page.getByRole("table", { name: "Staff accounts" })).toHaveCount(0);
});

test("workspace navigation shows only the signed-in role's areas", async ({ page }) => {
  await authAPI(page, ["clinician"]);
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/workspace");
  await expect(page.getByRole("heading", { name: "Clinical workspace" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Clinical navigation" }).getByRole("link", { name: "Care plans" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Reception desk" })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1024);
});

for (const path of ["/workspace", "/reception"]) {
  test(`logout from ${path} reports failure honestly and revokes before navigating`, async ({ page }) => {
    const state = await authAPI(page);
    await page.goto(path);
    const signOut = page.locator("header").getByRole("button", { name: "Sign out", exact: true });
    await expect(signOut).toBeVisible();
    state.logoutStatus = 503;
    await signOut.click();
    await expect(page.getByRole("alert").filter({ hasText: "Sign out could not be confirmed" })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    expect(state.logouts).toBe(1);
    state.logoutStatus = 204;
    await signOut.click();
    await expect(page).toHaveURL(/\/sign-in$/);
    expect(state.logouts).toBe(2);
    await page.goto(path);
    await expect(page).toHaveURL(/\/sign-in$/);
  });
}

test("expiry removes protected content and a rejected refresh cannot restore it", async ({ page }) => {
  await page.clock.install();
  const state = await authAPI(page);
  await page.goto("/workspace");
  await expect(page.getByRole("heading", { name: "Staff workspace" })).toBeVisible();
  state.authenticated = false;
  await page.clock.fastForward(61_000);
  await expect(page.getByRole("heading", { name: "Staff workspace" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Staff session" })).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("public access help does not collect passwords or pretend to submit account requests", async ({ page }) => {
  await authAPI(page, [], false);
  await page.goto("/sign-up");
  await expect(page.getByText("Contact your clinic administrator", { exact: false })).toBeVisible();
  await expect(page.locator("form")).toHaveCount(0);
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
});

async function staffAPI(page: Page) {
  await authAPI(page, ["administrator"]);
  const roles = ["receptionist", "clinician", "therapist", "dispensary", "billing", "administrator", "report_reader"].map(code => ({ code, name: code === "report_reader" ? "Report reader" : code[0].toUpperCase() + code.slice(1) }));
  const staff = { id: "synthetic-managed", loginIdentifier: "synthetic-managed", roles: ["billing"], active: true, createdAt: "2026-11-02T00:00:00Z" };
  const state = { creates: 0, roleChanges: 0, disables: 0 };
  await page.route("**/api/v1/admin/staff**", async route => {
    const request = route.request();
    if (request.method() === "GET") return route.fulfill({ json: { items: [staff], roles } });
    expect(request.headers()["x-csrf-token"]).toBe("synthetic-fresh-csrf");
    if (request.url().endsWith("/roles")) {
      state.roleChanges++;
      expect(request.method()).toBe("PUT");
      staff.roles = request.postDataJSON().roles;
    } else if (request.url().endsWith("/disable")) {
      state.disables++;
      staff.active = false;
      return route.fulfill({ status: 204, body: "" });
    } else {
      state.creates++;
      expect(request.method()).toBe("POST");
      expect(request.postDataJSON()).toEqual({ loginIdentifier: "synthetic-new", password: "synthetic-initial-password", roles: ["receptionist"] });
      return route.fulfill({ status: 201, json: { ...staff, id: "synthetic-new", loginIdentifier: "synthetic-new" } });
    }
    return route.fulfill({ json: staff });
  });
  return state;
}

test("Figma staff table and dialog preserve create, role changes, disable and keyboard dismissal", async ({ page }) => {
  const state = await staffAPI(page);
  await page.goto("/administration");
  await expect(page.getByRole("table", { name: "Staff accounts" })).toContainText("synthetic-managed");
  const create = page.getByRole("button", { name: "+ Create staff account", exact: true });
  await create.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Login identifier *", { exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(create).toBeFocused();
  await create.click();
  await dialog.getByLabel("Login identifier *", { exact: true }).fill("synthetic-new");
  await dialog.getByLabel("Initial password *", { exact: true }).fill("synthetic-initial-password");
  await dialog.getByLabel("Receptionist", { exact: true }).check();
  await dialog.getByRole("button", { name: "Create staff account", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.creates).toBe(1);
  await page.getByRole("button", { name: "Manage access for synthetic-managed", exact: true }).click();
  await dialog.getByLabel("Billing", { exact: true }).uncheck();
  await dialog.getByLabel("Clinician", { exact: true }).check();
  await dialog.getByRole("button", { name: "Save roles", exact: true }).click();
  await expect(page.getByRole("table", { name: "Staff accounts" })).toContainText("Clinician");
  expect(state.roleChanges).toBe(1);
  await page.getByRole("button", { name: "Manage access for synthetic-managed", exact: true }).click();
  page.once("dialog", confirmation => confirmation.accept());
  await dialog.getByRole("button", { name: "Disable account", exact: true }).click();
  await expect(page.getByRole("table", { name: "Staff accounts" })).toContainText("Disabled");
  expect(state.disables).toBe(1);
});

for (const width of [1366, 1024]) {
  test(`Figma layouts fit ${width}x768 with local artwork and password visibility`, async ({ page }) => {
    await page.setViewportSize({ width, height: 768 });
    await authAPI(page, [], false);
    await page.goto("/sign-in");
    await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeEnabled();
    await page.getByLabel("Password", { exact: true }).fill("synthetic-password");
    await page.getByLabel("Show password", { exact: true }).check();
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
    await page.getByLabel("Show password", { exact: true }).uncheck();
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "password");
    for (const asset of ["sprout.svg", "botanical-signin.svg", "mortar.svg"]) {
      await expect(page.locator(`img[src="/brand/${asset}"]`)).toHaveJSProperty("complete", true);
      expect(await page.locator(`img[src="/brand/${asset}"]`).evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await staffAPI(page);
    await page.goto("/administration");
    await expect(page.getByRole("table", { name: "Staff accounts" })).toContainText("synthetic-managed");
    for (const image of await page.locator('img[src^="/brand/"]').all()) {
      await expect(image).toHaveJSProperty("complete", true);
      expect(await image.evaluate((asset: HTMLImageElement) => asset.naturalWidth)).toBeGreaterThan(0);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("button", { name: "+ Create staff account", exact: true }).click();
    const box = await page.getByRole("dialog").boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    expect(box!.height).toBeLessThanOrEqual(768);
  });
}
