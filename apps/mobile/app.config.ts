import type { ExpoConfig } from "expo/config";

/**
 * Dynamic Expo config.
 *
 * Замінює `app.json` щоб можна було читати змінні з `process.env` для
 * EAS build (див. `apps/mobile/docs/mobile.md`). Усі поля що раніше
 * жили в `app.json` перенесені сюди один-в-один.
 */
const updatesUrl = process.env.EXPO_PUBLIC_EAS_UPDATES_URL;

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
    // Registers `sergeant://…` as an app link. Expo Router's
    // file-based routes handle the specific deep-link targets; this
    // manifest entry is what tells Android that our app is the default
    // handler for URLs with this scheme. See `src/lib/useDeepLinks.ts`
    // for the runtime side of the contract.
    //
    // TODO (Phase 10 follow-up): once `https://sergeant.2dmanager.com.ua`
    // publishes `.well-known/assetlinks.json`, add a second intent
    // filter with `autoVerify: true` + `data.scheme: "https"` so that
    // web→native universal links work without a picker. iOS universal
    // links (`associatedDomains: ["applinks:sergeant.2dmanager.com.ua"]`)
    // are gated on the same prerequisite and intentionally deferred.
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: false,
        data: [{ scheme: "sergeant" }],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
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
