import { chartPalette } from "./src/modules/finyk/constants/chartPalette.js";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"DM Sans"',
          "system-ui",
          "-apple-system",
          '"Segoe UI"',
          "sans-serif",
        ],
      },
      colors: {
        // Semantic UI colors — defined as CSS variables so dark mode works
        // automatically without adding dark: prefix to every element.
        bg: "rgb(var(--c-bg) / <alpha-value>)",
        panel: "rgb(var(--c-panel) / <alpha-value>)",
        panelHi: "rgb(var(--c-panel-hi) / <alpha-value>)",
        line: "rgb(var(--c-line) / <alpha-value>)",
        text: "rgb(var(--c-text) / <alpha-value>)",
        muted: "rgb(var(--c-muted) / <alpha-value>)",
        subtle: "rgb(var(--c-subtle) / <alpha-value>)",
        primary: "rgb(var(--c-primary) / <alpha-value>)",
        // Static accent/status colors (unchanged in dark mode)
        success: "#16a34a",
        danger: "#dc2626",
        warning: "#b45309",
        accent: "#a3e635", // lime-green CTA (hero buttons)
        forest: "#0f2d1a", // dark green hero card background
        /** Фінік: сегменти діаграми категорій (джерело — chartPalette.js) */
        chart: chartPalette,
        /** Модуль «Рутина» — коралова палітра */
        routine: {
          DEFAULT: "#e0786c",
          hover: "#d46356",
          nav: "#e85d4f",
          strong: "#c24133",
          kicker: "#b45348",
          eyebrow: "#d65d4f",
          surface: "#fff0eb",
          surface2: "#fff5f2",
          surface3: "#fff8f5",
          line: "#f5c4b8",
          ring: "#f0a090",
          done: "#b91c1c",
        },
        /** Модуль «Харчування» — помаранчевий акцент (локально для UI-станів) */
        nutrition: {
          DEFAULT: "#f97316", // orange-500
          hover: "#ea580c", // orange-600
          soft: "#fff7ed", // orange-50
          ring: "#fed7aa", // orange-200
        },
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "24px",
        "4xl": "32px",
      },
      boxShadow: {
        // Use CSS variables so shadows adapt to dark mode automatically
        soft: "var(--shadow-soft)",
        card: "var(--shadow-card)",
        float: "var(--shadow-float)",
        glow: "0 0 0 3px rgba(22,163,74,0.15)",
      },
      backgroundImage: {
        "forest-grad": "linear-gradient(135deg, #0f2d1a 0%, #1e4d2b 100%)",
        hero: "linear-gradient(150deg, #eef3fc 0%, #f8faff 100%)",
        "hero-g": "linear-gradient(150deg, #f0f5ff 0%, #ffffff 100%)",
        "pulse-ok":
          "linear-gradient(135deg, rgba(22,163,74,.07) 0%, transparent 70%)",
        "pulse-w":
          "linear-gradient(135deg, rgba(180,83,9,.07) 0%, transparent 70%)",
        "pulse-b":
          "linear-gradient(135deg, rgba(220,38,38,.07) 0%, transparent 70%)",
        "routine-hero":
          "linear-gradient(135deg, #ffede8 0%, #fff7ed 45%, rgba(254, 215, 199, 0.65) 100%)",
      },
      fontSize: {
        "2xs": ["10px", { lineHeight: "14px" }],
      },
    },
  },
  plugins: [],
};
