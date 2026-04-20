/**
 * Sergeant Brand Palette — Soft & Organic with Emerald/Teal accent
 *
 * Design Philosophy:
 * - Warm, friendly, approachable colors inspired by Duolingo/Yazio/Monobank
 * - Soft pastels with rich saturated accents
 * - Each color has semantic meaning in the app context
 */

// Primary Brand Colors
export const brandColors = {
  // Primary accent — Emerald/Teal spectrum
  emerald: {
    50: "#ecfdf5",
    100: "#d1fae5",
    200: "#a7f3d0",
    300: "#6ee7b7",
    400: "#34d399",
    500: "#10b981",
    600: "#059669",
    700: "#047857",
    800: "#065f46",
    900: "#064e3b",
  },
  teal: {
    50: "#f0fdfa",
    100: "#ccfbf1",
    200: "#99f6e4",
    300: "#5eead4",
    400: "#2dd4bf",
    500: "#14b8a6",
    600: "#0d9488",
    700: "#0f766e",
    800: "#115e59",
    900: "#134e4a",
  },
  // Warm cream backgrounds (replacing cold blue-gray)
  cream: {
    50: "#fefdfb",
    100: "#fdf9f3",
    200: "#faf3e8",
    300: "#f5ead8",
    400: "#eedcc4",
    500: "#e4ccab",
  },
  // Soft coral for Routine module
  coral: {
    50: "#fff5f3",
    100: "#ffe8e3",
    200: "#ffd4cb",
    300: "#ffb4a6",
    400: "#ff8c78",
    500: "#f97066",
    600: "#e64d4d",
    700: "#c23a3a",
    800: "#a13333",
    900: "#862e2e",
  },
  // Fresh lime for Nutrition module
  lime: {
    50: "#f8fee7",
    100: "#effccb",
    200: "#dff99d",
    300: "#c8f264",
    400: "#b0e636",
    500: "#92cc17",
    600: "#71a30d",
    700: "#567c0f",
    800: "#466212",
    900: "#3b5314",
  },
};

/**
 * Chart segments palette — soft organic colors for pie charts
 * Harmonious, balanced, not too saturated
 */
export const chartPalette = {
  1: "#10b981", // emerald-500 (primary)
  2: "#14b8a6", // teal-500
  3: "#f97066", // coral-500
  4: "#92cc17", // lime-500
  5: "#60a5fa", // blue-400 (soft)
  6: "#a78bfa", // violet-400 (soft)
  7: "#fbbf24", // amber-400 (warm)
  8: "#f472b6", // pink-400 (soft)
};

export const chartPaletteList = Object.values(chartPalette);

/**
 * Module-specific accent colors
 * Each module has its own personality
 */
export const moduleColors = {
  finyk: {
    primary: "#10b981", // emerald-500
    secondary: "#14b8a6", // teal-500
    surface: "#ecfdf5", // emerald-50
    surfaceAlt: "#f0fdfa", // teal-50
  },
  fizruk: {
    primary: "#14b8a6", // teal-500
    secondary: "#0d9488", // teal-600
    surface: "#f0fdfa", // teal-50
    accent: "#c8f264", // lime-300 (CTA highlight)
  },
  routine: {
    primary: "#f97066", // coral-500
    secondary: "#ff8c78", // coral-400
    surface: "#fff5f3", // coral-50
    surfaceAlt: "#ffe8e3", // coral-100
  },
  nutrition: {
    primary: "#92cc17", // lime-500
    secondary: "#b0e636", // lime-400
    surface: "#f8fee7", // lime-50
    surfaceAlt: "#effccb", // lime-100
  },
};

/**
 * Status/Semantic colors — consistent across app
 */
export const statusColors = {
  success: "#10b981", // emerald-500
  warning: "#f59e0b", // amber-500
  danger: "#ef4444", // red-500
  info: "#0ea5e9", // sky-500
};
