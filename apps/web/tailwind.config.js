import designTokensPreset from "@sergeant/design-tokens/tailwind-preset";

/** @type {import('tailwindcss').Config} */
export default {
  presets: [designTokensPreset],
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",
  plugins: [],
};
