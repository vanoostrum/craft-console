import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT ?? 3000);

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${port}` },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm start",
    url: `http://localhost:${port}/api/health`,
    reuseExistingServer: true,
    env: { CONSOLE_DATA: "fixtures", PORT: String(port) },
    timeout: 60_000,
  },
});
