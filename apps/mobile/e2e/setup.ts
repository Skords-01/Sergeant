/**
 * Per-suite Detox lifecycle hooks (`setupFilesAfterEach` equivalents).
 *
 * Runs before each `*.e2e.ts` file and installs:
 *   - `beforeAll` — launches the app with the `EXPO_PUBLIC_E2E=1`
 *     environment variable so the tabs layout bypass-s Better Auth
 *     (see `apps/mobile/app/(tabs)/_layout.tsx`).
 *   - `beforeEach` — resets the app state via `reloadReactNative()` so
 *     suites don't leak MMKV-backed transactions between tests.
 *
 * We don't call `device.terminateApp()` in `afterAll` — Detox already
 * shuts the app (and optionally the device) via the global teardown
 * configured in `.detoxrc.js` → `behavior.cleanup`.
 */
import { device } from "detox";

beforeAll(async () => {
  await device.launchApp({
    newInstance: true,
    launchArgs: {
      // Shared flag with the Metro bundler so the Overview / Transactions
      // pages can seed a deterministic dataset in a follow-up PR.
      detoxE2E: "1",
    },
    // `EXPO_PUBLIC_*` variables set here are injected into the RN
    // process by Detox's `launchApp` launcher; Metro already inlines the
    // value at bundle time for production builds, so this affects dev /
    // Detox binaries only.
    languageAndLocale: { language: "uk", locale: "uk-UA" },
    permissions: { notifications: "YES" },
  });
});

beforeEach(async () => {
  await device.reloadReactNative();
});
