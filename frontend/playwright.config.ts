import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  workers: 2,
  use: { baseURL: "http://127.0.0.1:3100", browserName: "chromium" },
  webServer: {
    command: "node tests/browser/start-server.mjs",
    url: "http://127.0.0.1:3100/sign-in",
    timeout: 60_000,
  },
});
