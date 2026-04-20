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
