/**
 * Jest config for @sergeant/mobile.
 *
 * Uses the `jest-expo` preset which ships Metro-compatible transforms,
 * mocks for native modules (Expo, Reanimated, AsyncStorage, MMKV, etc.)
 * and a jsdom-free RN runtime. We run only tests under `src/**` to keep
 * Expo Router's app-directory out of Jest's test discovery.
 */
module.exports = {
  preset: "jest-expo",
  testMatch: ["<rootDir>/src/**/*.test.{ts,tsx}"],
  transformIgnorePatterns: [
    // Keep the default `node_modules/` ignore but punch holes for the RN
    // / Expo / NativeWind ecosystem, whose published artefacts still
    // contain Flow / TSX / ESM syntax that Jest needs to transpile. The
    // extra `.pnpm/(?:.*\\+)?` segment accommodates pnpm's nested
    // `node_modules/.pnpm/<scope>+<pkg>@<ver>/node_modules/…` layout.
    "node_modules/(?!(\\.pnpm/(?:.*\\+)?)?((jest-)?react-native(-.*)?|@react-native(-community)?(/.*)?|expo(nent)?|@expo(nent)?(/.*)?|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|nativewind|react-native-css-interop))",
  ],
};
