import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@sergeant/shared": path.resolve(
        import.meta.dirname,
        "../../packages/shared/src/index.ts",
      ),
    },
  },
  esbuild: {
    // Skip tsconfig resolution that fails for @sergeant/shared
    // (its tsconfig extends @sergeant/config/tsconfig.base.json which
    // tsconfck can't resolve in the workspace without the symlink).
    tsconfigRaw: "{}",
  },
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    passWithNoTests: true,
    // Testcontainers needs time for container startup + migrations.
    testTimeout: 60_000,
    hookTimeout: 120_000,
    // Run integration tests sequentially — they share a single Postgres
    // container and truncate between suites.
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
  },
});
