import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT ?? 3000);

export default defineConfig({
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${port}` },
  projects: [
    { name: "e2e", testDir: "e2e", use: { ...devices["Desktop Chrome"] } },
    {
      name: "design",
      testDir: "tests/design",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm start",
    url: `http://localhost:${port}/api/health`,
    reuseExistingServer: true,
    env: {
      CONSOLE_DATA: "fixtures",
      CONSOLE_NOW: "2026-11-22T12:00:00Z",
      PORT: String(port),
    },
    timeout: 60_000,
  },
});
