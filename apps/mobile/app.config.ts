import type { ExpoConfig } from "expo/config";

/**
 * Dynamic Expo config.
 *
 * Замінює `app.json` щоб можна було читати змінні з `process.env` для
 * EAS build (див. `apps/mobile/docs/mobile.md`). Усі поля що раніше
 * жили в `app.json` перенесені сюди один-в-один.
 */
const updatesUrl = process.env.EXPO_PUBLIC_EAS_UPDATES_URL;

/**
 * Detox patches the generated iOS / Android projects (see
 * `apps/mobile/.detoxrc.js` + `apps/mobile/e2e/*`). We register the
 * plugin conditionally so production EAS builds do NOT ship the
 * `DetoxActivity` / test-target scaffolding.
 *
 * Gate:
 *   - `EXPO_PUBLIC_E2E=1` — contributor / CI Detox build.
 *   - `E2E_BUILD=1`        — explicit override for prebuild pipelines
 *     that don't want to leak `EXPO_PUBLIC_*` into the bundled JS.
 *
 * Docs: `docs/react-native-migration.md` §8 / §13 Q8.
 */
const isDetoxBuild =
  process.env.EXPO_PUBLIC_E2E === "1" || process.env.E2E_BUILD === "1";

const config = (): ExpoConfig => ({
  name: "Sergeant",
  slug: "sergeant",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  scheme: "sergeant",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  runtimeVersion: { policy: "sdkVersion" },
  ...(updatesUrl ? { updates: { url: updatesUrl } } : {}),
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#0b0d10",
  },
  assetBundlePatterns: ["**/*"],
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.sergeant.app",
    infoPlist: {
      UIBackgroundModes: ["remote-notification"],
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#0b0d10",
    },
    package: "com.sergeant.app",
  },
  web: {
    bundler: "metro",
    output: "static",
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-notifications",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#0b0d10",
        image: "./assets/splash.png",
        imageWidth: 200,
      },
    ],
    // Sentry native plugin — required by `@sentry/react-native` for
    // the iOS/Android native build to link the RNSentry module. Source
    // maps are only uploaded at EAS build time when `SENTRY_AUTH_TOKEN`
    // + `SENTRY_ORG` + `SENTRY_PROJECT` are set; otherwise the plugin
    // no-ops and JS Sentry still initialises via `EXPO_PUBLIC_SENTRY_DSN`
    // (see `src/lib/observability.ts`).
    "@sentry/react-native/expo",
    // Detox config plugin patches the generated native projects with
    // the Detox instrumentation target. Only registered for dedicated
    // E2E builds so production IPAs / AABs are unaffected.
    ...(isDetoxBuild ? ["@config-plugins/detox"] : []),
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
    eas: {
      projectId: process.env.EAS_PROJECT_ID,
    },
  },
});

export default config;
