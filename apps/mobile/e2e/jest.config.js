/**
 * Jest config for Detox E2E suites.
 *
 * Lives in `apps/mobile/e2e/jest.config.js` (referenced from
 * `.detoxrc.js`). It is deliberately separate from the unit-test config
 * at `apps/mobile/jest.config.js`:
 *
 *   - `testMatch` only picks up `*.e2e.ts` files so Detox does not try
 *     to run the `src/**\/*.test.tsx` suites that already pass through
 *     jest-expo.
 *   - `testEnvironment: ./environment.js` swaps in Detox's Jest
 *     environment (required for the `device` / `element` globals).
 *   - `maxWorkers: 1` because Detox coordinates a single iOS simulator
 *     / Android emulator per run.
 *   - `globalSetup` / `globalTeardown` own the Detox lifecycle so
 *     individual suites only need to call `device.launchApp()`.
 */
/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  rootDir: "..",
  testMatch: ["<rootDir>/e2e/**/*.e2e.ts"],
  testEnvironment: "<rootDir>/e2e/environment.js",
  testRunner: "jest-circus/runner",
  transform: {
    "\\.tsx?$": [
      "babel-jest",
      {
        presets: [
          ["babel-preset-expo", { jsxRuntime: "automatic" }],
          "@babel/preset-typescript",
        ],
      },
    ],
  },
  globalSetup: "detox/runners/jest/globalSetup",
  globalTeardown: "detox/runners/jest/globalTeardown",
  reporters: ["detox/runners/jest/reporter"],
  setupFilesAfterEnv: ["<rootDir>/e2e/setup.ts"],
  verbose: true,
  maxWorkers: 1,
};
