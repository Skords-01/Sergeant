import type { UserConfig } from "vitest/config";

/**
 * Shared Vitest defaults used by every package in the monorepo. Individual
 * packages override `include`, `environment`, `setupFiles` and path aliases
 * as needed.
 */
export const baseVitestConfig: UserConfig = {
  test: {
    environment: "node",
    passWithNoTests: true,
  },
};

/**
 * Shared coverage configuration. Each package merges this into its own
 * `test.coverage` block. v8 provider is fast and ships with Node — no extra
 * native deps. We deliberately do NOT set thresholds here yet: this PR
 * establishes the baseline. A follow-up will lock per-package floors so
 * future PRs cannot decrease coverage.
 */
export const baseCoverageConfig = {
  provider: "v8" as const,
  reporter: ["text", "html", "json-summary", "lcov"] as const,
  reportsDirectory: "./coverage",
  exclude: [
    "**/node_modules/**",
    "**/dist/**",
    "**/dist-server/**",
    "**/coverage/**",
    "**/*.test.{js,jsx,ts,tsx,mjs}",
    "**/*.spec.{js,jsx,ts,tsx,mjs}",
    "**/__tests__/**",
    "**/__mocks__/**",
    "**/test/**",
    "**/tests/**",
    "**/*.d.ts",
    "**/*.config.{js,cjs,mjs,ts}",
    "**/build.mjs",
    "**/migrate.mjs",
  ],
};
