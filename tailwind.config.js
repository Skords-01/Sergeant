import {
  chartPalette,
  brandColors,
  moduleColors,
  statusColors,
} from "./src/modules/finyk/constants/chartPalette.js";

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
        display: [
          '"DM Sans"',
          "system-ui",
          "-apple-system",
          '"Segoe UI"',
          "sans-serif",
        ],
      },
      colors: {
        // ═══════════════════════════════════════════════════════════════════
        // SEMANTIC UI COLORS — CSS variables for automatic dark mode support
        // ═══════════════════════════════════════════════════════════════════
        bg: "rgb(var(--c-bg) / <alpha-value>)",
        panel: "rgb(var(--c-panel) / <alpha-value>)",
        panelHi: "rgb(var(--c-panel-hi) / <alpha-value>)",
        line: "rgb(var(--c-line) / <alpha-value>)",
        text: "rgb(var(--c-text) / <alpha-value>)",
        muted: "rgb(var(--c-muted) / <alpha-value>)",
        subtle: "rgb(var(--c-subtle) / <alpha-value>)",
        primary: "rgb(var(--c-primary) / <alpha-value>)",

        // ─── Semantic aliases (preferred in new code) ──────────────────────
        // Map 1:1 to the existing tokens above; dark mode "just works" because
        // they resolve through the same CSS variables.
        surface: "rgb(var(--c-panel) / <alpha-value>)",
        "surface-muted": "rgb(var(--c-panel-hi) / <alpha-value>)",
        fg: "rgb(var(--c-text) / <alpha-value>)",
        "fg-muted": "rgb(var(--c-muted) / <alpha-value>)",
        accent: "rgb(var(--c-accent) / <alpha-value>)",

        // ═══════════════════════════════════════════════════════════════════
        // BRAND COLORS — Soft & Organic palette with Emerald/Teal accent
        // ═══════════════════════════════════════════════════════════════════
        brand: {
          // Primary emerald accent
          DEFAULT: brandColors.emerald[500],
          light: brandColors.emerald[400],
          dark: brandColors.emerald[600],
          subtle: brandColors.emerald[50],
          ...brandColors.emerald,
        },
        teal: brandColors.teal,
        cream: brandColors.cream,
        coral: brandColors.coral,
        lime: brandColors.lime,

        // ═══════════════════════════════════════════════════════════════════
        // STATUS COLORS — Consistent semantic meanings
        // ═══════════════════════════════════════════════════════════════════
        success: statusColors.success,
        danger: statusColors.danger,
        warning: statusColors.warning,
        info: statusColors.info,

        // ═══════════════════════════════════════════════════════════════════
        // CHART PALETTE — For pie charts, graphs, data visualization
        // ═══════════════════════════════════════════════════════════════════
        chart: chartPalette,

        // ═══════════════════════════════════════════════════════════════════
        // MODULE-SPECIFIC COLORS — Each module has its own personality
        // ═══════════════════════════════════════════════════════════════════

        /** Фінік — Emerald/Teal финансовый трекер */
        finyk: {
          DEFAULT: moduleColors.finyk.primary,
          secondary: moduleColors.finyk.secondary,
          surface: moduleColors.finyk.surface,
          surfaceAlt: moduleColors.finyk.surfaceAlt,
          hover: brandColors.emerald[600],
          ring: brandColors.emerald[200],
          soft: brandColors.emerald[50],
        },

        /** Фізрук — Teal fitness tracker */
        fizruk: {
          DEFAULT: moduleColors.fizruk.primary,
          secondary: moduleColors.fizruk.secondary,
          surface: moduleColors.fizruk.surface,
          accent: moduleColors.fizruk.accent,
          hover: brandColors.teal[600],
          ring: brandColors.teal[200],
          soft: brandColors.teal[50],
        },

        /** Рутина — Soft coral habit tracker */
        routine: {
          DEFAULT: moduleColors.routine.primary,
          secondary: moduleColors.routine.secondary,
          surface: moduleColors.routine.surface,
          surfaceAlt: moduleColors.routine.surfaceAlt,
          hover: brandColors.coral[600],
          strong: brandColors.coral[700],
          kicker: brandColors.coral[600],
          eyebrow: brandColors.coral[500],
          line: brandColors.coral[200],
          ring: brandColors.coral[300],
          done: brandColors.coral[700],
          nav: brandColors.coral[500],
        },

        /** Харчування — Fresh lime nutrition tracker */
        nutrition: {
          DEFAULT: moduleColors.nutrition.primary,
          secondary: moduleColors.nutrition.secondary,
          surface: moduleColors.nutrition.surface,
          surfaceAlt: moduleColors.nutrition.surfaceAlt,
          hover: brandColors.lime[600],
          ring: brandColors.lime[200],
          soft: brandColors.lime[50],
        },
      },

      // ═══════════════════════════════════════════════════════════════════
      // BORDER RADIUS — Soft, organic, friendly shapes
      // ═══════════════════════════════════════════════════════════════════
      borderRadius: {
        "2xl": "16px",
        "3xl": "24px",
        "4xl": "32px",
        "5xl": "40px",
        full: "9999px",
      },

      // ═══════════════════════════════════════════════════════════════════
      // BOX SHADOWS — Soft, layered, premium feel
      // ═══════════════════════════════════════════════════════════════════
      boxShadow: {
        soft: "var(--shadow-soft)",
        card: "var(--shadow-card)",
        float: "var(--shadow-float)",
        glow: "0 0 0 3px rgba(16, 185, 129, 0.15)", // emerald glow
        "glow-teal": "0 0 0 3px rgba(20, 184, 166, 0.15)",
        "glow-coral": "0 0 0 3px rgba(249, 112, 102, 0.15)",
        "glow-lime": "0 0 0 3px rgba(146, 204, 23, 0.15)",
        // Elevated cards (hover state)
        cardHover:
          "0 2px 4px rgba(13, 23, 38, 0.06), 0 12px 32px rgba(13, 23, 38, 0.12)",
        // Inner shadows for depth
        inner: "inset 0 2px 4px rgba(0, 0, 0, 0.05)",
      },

      // ═══════════════════════════════════════════════════════════════════
      // GRADIENTS — Warm, organic, inviting
      // ═══════════════════════════════════════════════════════════════════
      backgroundImage: {
        // Page backgrounds — warm cream instead of cold blue
        "page-warm":
          "linear-gradient(180deg, rgb(var(--c-bg)) 0%, rgb(253, 249, 243) 100%)",

        // Hero gradients for each module
        "hero-emerald":
          "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 50%, #a7f3d0 100%)",
        "hero-teal":
          "linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 50%, #99f6e4 100%)",
        "hero-coral":
          "linear-gradient(135deg, #fff5f3 0%, #ffe8e3 50%, #ffd4cb 100%)",
        "hero-lime":
          "linear-gradient(135deg, #f8fee7 0%, #effccb 50%, #dff99d 100%)",

        // Hub hero — warm cream with subtle gradient
        "hub-hero":
          "linear-gradient(150deg, #fdf9f3 0%, #fefdfb 50%, #f0fdfa 100%)",

        // Card gradients (subtle)
        "card-emerald": "linear-gradient(135deg, #ecfdf5 0%, #ffffff 100%)",
        "card-teal": "linear-gradient(135deg, #f0fdfa 0%, #ffffff 100%)",
        "card-coral": "linear-gradient(135deg, #fff5f3 0%, #ffffff 100%)",
        "card-lime": "linear-gradient(135deg, #f8fee7 0%, #ffffff 100%)",

        hero: "linear-gradient(150deg, #fdf9f3 0%, #fefdfb 100%)",
        "hero-g": "linear-gradient(150deg, #f0fdfa 0%, #ffffff 100%)",
        "routine-hero":
          "linear-gradient(135deg, #fff5f3 0%, #ffe8e3 45%, rgba(255, 212, 203, 0.65) 100%)",

        // Pulse effects for status
        "pulse-ok":
          "linear-gradient(135deg, rgba(16, 185, 129, 0.07) 0%, transparent 70%)",
        "pulse-w":
          "linear-gradient(135deg, rgba(245, 158, 11, 0.07) 0%, transparent 70%)",
        "pulse-b":
          "linear-gradient(135deg, rgba(239, 68, 68, 0.07) 0%, transparent 70%)",
      },

      // ═══════════════════════════════════════════════════════════════════
      // TYPOGRAPHY — Readable, friendly, clear hierarchy
      // ═══════════════════════════════════════════════════════════════════
      fontSize: {
        "3xs": ["9px", { lineHeight: "12px" }],
        "2xs": ["10px", { lineHeight: "14px" }],
        xs: ["12px", { lineHeight: "16px" }],
        sm: ["14px", { lineHeight: "20px" }],
        base: ["16px", { lineHeight: "24px" }],
        lg: ["18px", { lineHeight: "28px" }],
        xl: ["20px", { lineHeight: "28px" }],
        "2xl": ["24px", { lineHeight: "32px" }],
        // `hero`: hero-section H1s and hero stat numbers (slightly larger
        // than 2xl for the page-greeting / headline-stat slot).
        hero: ["26px", { lineHeight: "32px" }],
        "3xl": ["30px", { lineHeight: "36px" }],
        "4xl": ["36px", { lineHeight: "40px" }],
        "5xl": ["48px", { lineHeight: "1" }],
      },

      // ═══════════════════════════════════════════════════════════════════
      // SPACING — Consistent rhythm
      // ═══════════════════════════════════════════════════════════════════
      spacing: {
        4.5: "18px",
        13: "52px",
        15: "60px",
        18: "72px",
        22: "88px",
      },

      // ═══════════════════════════════════════════════════════════════════
      // ANIMATIONS — Smooth, delightful, Duolingo-inspired
      // ═══════════════════════════════════════════════════════════════════
      animation: {
        // Entry animations
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "slide-down": "slideDown 0.3s ease-out",
        "scale-in": "scaleIn 0.2s ease-out",
        // Success/completion
        "check-pop": "checkPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
        "success-pulse": "successPulse 0.6s ease-out",
        // Interaction feedback
        "press-scale": "pressScale 0.15s ease-out",
        "hover-lift": "hoverLift 0.2s ease-out forwards",
        // Loading states
        shimmer: "shimmer 1.5s infinite",
        "pulse-soft": "pulseSoft 2s infinite",
        // Progress ring
        "progress-fill": "progressFill 1s ease-out forwards",
        // Bounce for notifications
        "bounce-in": "bounceIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideDown: {
          "0%": { opacity: "0", transform: "translateY(-12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        checkPop: {
          "0%": { transform: "scale(0)" },
          "50%": { transform: "scale(1.2)" },
          "100%": { transform: "scale(1)" },
        },
        successPulse: {
          "0%": { boxShadow: "0 0 0 0 rgba(16, 185, 129, 0.4)" },
          "70%": { boxShadow: "0 0 0 10px rgba(16, 185, 129, 0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(16, 185, 129, 0)" },
        },
        pressScale: {
          "0%": { transform: "scale(1)" },
          "50%": { transform: "scale(0.97)" },
          "100%": { transform: "scale(1)" },
        },
        hoverLift: {
          "0%": { transform: "translateY(0)", boxShadow: "var(--shadow-card)" },
          "100%": {
            transform: "translateY(-2px)",
            boxShadow: "var(--shadow-float)",
          },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        progressFill: {
          "0%": { strokeDashoffset: "100" },
          "100%": { strokeDashoffset: "var(--progress-offset, 0)" },
        },
        bounceIn: {
          "0%": { opacity: "0", transform: "scale(0.3)" },
          "50%": { transform: "scale(1.05)" },
          "70%": { transform: "scale(0.9)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },

      // ═══════════════════════════════════════════════════════════════════
      // TRANSITIONS — Consistent timing
      // ═══════════════════════════════════════════════════════════════════
      transitionDuration: {
        DEFAULT: "200ms",
        fast: "150ms",
        slow: "300ms",
        slower: "400ms",
      },
      transitionTimingFunction: {
        bounce: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        smooth: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        spring: "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
      },

      // ═══════════════════════════════════════════════════════════════════
      // BACKDROP BLUR — Glass effects
      // ═══════════════════════════════════════════════════════════════════
      backdropBlur: {
        xs: "2px",
        sm: "4px",
        DEFAULT: "8px",
        md: "12px",
        lg: "16px",
        xl: "24px",
        "2xl": "40px",
      },

      // ═══════════════════════════════════════════════════════════════════
      // Z-INDEX — Layering system
      // ═══════════════════════════════════════════════════════════════════
      zIndex: {
        0: "0",
        10: "10",
        20: "20",
        30: "30",
        40: "40",
        50: "50",
        header: "100",
        modal: "200",
        toast: "300",
        tooltip: "400",
      },
    },
  },
  plugins: [],
};
