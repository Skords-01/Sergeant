/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg:       "#f0f3f8",   // light blue-gray page bg
        panel:    "#ffffff",   // white cards
        panelHi:  "#f5f7fc",   // hover/input bg
        line:     "#e2e8f4",   // subtle border
        text:     "#0d1726",   // near-black
        muted:    "#607590",   // medium slate
        subtle:   "#96a8bc",   // light slate (labels)
        primary:  "#0d1726",   // ink color (same as text) — used sparingly
        success:  "#16a34a",   // green
        danger:   "#dc2626",   // red
        warning:  "#b45309",   // amber
        accent:   "#a3e635",   // lime-green CTA (hero buttons)
        forest:   "#0f2d1a",   // dark green hero card background
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "24px",
        "4xl": "32px",
      },
      boxShadow: {
        // overlay / sheets
        soft:  "0 8px 48px rgba(13,23,38,0.16)",
        // regular cards — two-layer: tight contact + wide ambient
        card:  "0 1px 2px rgba(13,23,38,0.05), 0 6px 24px rgba(13,23,38,0.10), inset 0 1px 0 rgba(255,255,255,0.80)",
        // hero / elevated cards — more pronounced lift
        float: "0 2px 6px rgba(13,23,38,0.07), 0 16px 48px rgba(13,23,38,0.14), inset 0 1px 0 rgba(255,255,255,0.70)",
        glow:  "0 0 0 3px rgba(22,163,74,0.15)",
      },
      backgroundImage: {
        "forest-grad": "linear-gradient(135deg, #0f2d1a 0%, #1e4d2b 100%)",
        "hero":    "linear-gradient(150deg, #eef3fc 0%, #f8faff 100%)",
        "hero-g":  "linear-gradient(150deg, #f0f5ff 0%, #ffffff 100%)",
        "pulse-ok":"linear-gradient(135deg, rgba(22,163,74,.07) 0%, transparent 70%)",
        "pulse-w": "linear-gradient(135deg, rgba(180,83,9,.07) 0%, transparent 70%)",
        "pulse-b": "linear-gradient(135deg, rgba(220,38,38,.07) 0%, transparent 70%)",
      },
      fontSize: {
        "2xs": ["10px", { lineHeight: "14px" }],
      },
    },
  },
  plugins: [],
};
