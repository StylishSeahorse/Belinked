import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against a production build (`npm run build` first) with a
 * throwaway SQLite database, so they never touch real data.
 * Set PW_CHROMIUM_PATH to use a preinstalled Chromium instead of Playwright's download.
 */
const port = Number(process.env.E2E_PORT || 3100);
const env = {
  DATABASE_URL: "file:./e2e.db",
  APP_URL: `http://localhost:${port}`,
  SESSION_SECRET: "e2e-session-secret-e2e-session-secret-123",
  COOKIE_SECURE: "false",
  NODE_ENV: "production"
};
const launchOptions = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: { baseURL: `http://localhost:${port}`, trace: "retain-on-failure", launchOptions },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], launchOptions }, testMatch: /flow\.spec\.ts/ },
    { name: "features", use: { ...devices["Desktop Chrome"], launchOptions }, testMatch: /features\.spec\.ts/, dependencies: ["desktop"] },
    { name: "mobile", use: { ...devices["Pixel 7"], launchOptions }, testMatch: /mobile\.spec\.ts/, dependencies: ["features"] }
  ],
  webServer: {
    command: `rm -f prisma/e2e.db prisma/e2e.db-journal && npx prisma db push --skip-generate && npx tsx prisma/seed.ts && npx next start -p ${port}`,
    url: `http://localhost:${port}/robots.txt`,
    env,
    timeout: 120_000,
    reuseExistingServer: false
  }
});
