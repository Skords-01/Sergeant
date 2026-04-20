// `@sergeant/design-tokens` is an ESM package; when required from this CJS
// config Node wraps it as `{ __esModule, default }`, so we unwrap here.
const designTokensPreset = require("@sergeant/design-tokens/tailwind-preset");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  // NativeWind's preset MUST come first so Sergeant design tokens layer on top
  // of its RN-specific defaults.
  presets: [
    require("nativewind/preset"),
    designTokensPreset.default ?? designTokensPreset,
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
