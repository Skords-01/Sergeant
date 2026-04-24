import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke E2E config (separate from the a11y lane).
 *
 * This lane boots:
 *  - Postgres via docker-compose (root `docker-compose.yml`)
 *  - API server (`@sergeant/server`, :3000)
 *  - Web preview (`@sergeant/web`, :4173) built against VITE_API_BASE_URL=:3000
 */
export default defineConfig({
  testDir: "./tests/smoke",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.PW_BASE_URL || "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.PW_SKIP_WEBSERVER
    ? undefined
    : {
        // Keep `pnpm --filter @sergeant/server dev` in background and
        // leave `web preview` in foreground for Playwright to manage.
        command:
          "sh -lc 'pnpm db:up && pnpm db:migrate && (pnpm --filter @sergeant/server dev &) && pnpm --filter @sergeant/web build && pnpm --filter @sergeant/web preview -- --port 4173 --host 127.0.0.1'",
        url: "http://127.0.0.1:4173",
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
        stdout: "pipe",
        stderr: "pipe",
        env: {
          ...process.env,
          DATABASE_URL:
            process.env.DATABASE_URL ||
            "postgresql://hub:hub@127.0.0.1:5432/hub",
          BETTER_AUTH_SECRET:
            process.env.BETTER_AUTH_SECRET ||
            // 32+ chars, deterministic but non-production.
            "smoke_test_better_auth_secret_32_chars_min",
          AI_QUOTA_DISABLED: process.env.AI_QUOTA_DISABLED || "1",
          VITE_API_BASE_URL:
            process.env.VITE_API_BASE_URL || "http://127.0.0.1:3000",
        },
      },
});

