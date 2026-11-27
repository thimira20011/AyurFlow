import { defineConfig } from "@playwright/test";
import fullstack, { fullstackServer } from "./playwright.fullstack.config";

export default defineConfig({
  ...fullstack,
  testDir: "./tests/performance",
  timeout: 12 * 60_000,
  reporter: "list",
  webServer: {
    ...fullstackServer,
    env: { AUTH_E2E_PERFORMANCE: "yes" },
  },
});
