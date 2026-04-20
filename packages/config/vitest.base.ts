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
