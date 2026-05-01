/**
 * Shared Vitest defaults used by every package in the monorepo. Individual
 * packages override `include`, `environment`, `setupFiles` and path aliases
 * as needed.
 *
 * AI-NOTE: this file is plain `.js` (not `.ts`) so Node's ESM loader can
 * resolve it through the `@sergeant/config/vitest.base` package export
 * without a transpiler. Vitest config files are loaded by vite-node which
 * handles their own `.ts`, but transitive imports across package boundaries
 * fall back to native Node ESM and choke on `.ts`. See PR #719 / #720.
 *
 * @type {import("vitest/config").UserConfig}
 */
export const baseVitestConfig = {
  test: {
    environment: "node",
    passWithNoTests: true,
  },
};

/**
 * Shared coverage configuration. Each package merges this into its own
 * `test.coverage` block. v8 provider is fast and ships with Node — no extra
 * native deps.
 *
 * Baseline thresholds (lines/functions/branches): packages that fall below
 * these floors will fail CI. Individual packages may raise (not lower) these
 * in their own vitest.config to enforce stricter per-package contracts.
 */
export const baseCoverageConfig = {
  provider: /** @type {const} */ ("v8"),
  reporter: /** @type {const} */ (["text", "html", "json-summary", "lcov"]),
  reportsDirectory: "./coverage",
  thresholds: {
    lines: 60,
    functions: 60,
    branches: 55,
    statements: 60,
  },
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
