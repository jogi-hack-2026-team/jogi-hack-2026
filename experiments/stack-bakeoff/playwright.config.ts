import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "frontend.spec.ts",
  workers: 1,
  timeout: 30000,
  reporter: [["list"], ["json", { outputFile: "results/local-e2e.json" }]],
  use: {
    channel: "chrome",
    headless: true,
    viewport: { width: 1100, height: 850 },
  },
  projects: [
    { name: "vite", use: { baseURL: "http://127.0.0.1:4173" } },
    { name: "next", use: { baseURL: "http://127.0.0.1:4174" } },
    { name: "tanstack", use: { baseURL: "http://127.0.0.1:4175" } },
  ],
  webServer: [
    {
      command: "npm.cmd run dev:vite",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command: "npm.cmd run dev:next",
      url: "http://127.0.0.1:4174",
      reuseExistingServer: false,
      timeout: 120000,
      env: { NEXT_TELEMETRY_DISABLED: "1" },
    },
    {
      command: "npm.cmd run api:integration",
      url: "http://127.0.0.1:4310/tracks",
      reuseExistingServer: false,
      timeout: 60000,
    },
    {
      command: "npm.cmd run dev:tanstack",
      url: "http://127.0.0.1:4175",
      reuseExistingServer: false,
      timeout: 60000,
    },
  ],
});
