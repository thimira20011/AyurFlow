import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/fullstack",
  testMatch: "*.spec.ts",
  workers: 1,
  retries: 0,
  timeout: 90_000,
  reporter: [["list"], ["json", { outputFile: "../.cache/auth-e2e/results.json" }]],
  use: {
    baseURL: "https://localhost:3443",
    browserName: "chromium",
    // Only this isolated fixture uses a self-signed certificate. Secure cookies stay enabled.
    ignoreHTTPSErrors: true,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  webServer: {
    command: "node tests/fullstack/start.mjs",
    url: "https://localhost:3443/api/v1/ready",
    ignoreHTTPSErrors: true,
    timeout: 180_000,
    reuseExistingServer: false,
    gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
  },
});
