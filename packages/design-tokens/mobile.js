/**
 * Mobile spacing / radius / colour constants for `apps/mobile`.
 *
 * Single source of truth for the React Native theme — re-exported by
 * `apps/mobile/src/theme.ts`. Keeps mobile-specific scalar tokens in the
 * shared design-tokens package so future cross-app work (e.g. a Capacitor
 * shell variant) can consume the same values.
 *
 * AI-NOTE: must stay `.js` + `.d.ts` (see AGENTS.md anti-pattern #2 / #720).
 */

/**
 * @type {Readonly<{
 *   bg: string;
 *   surface: string;
 *   border: string;
 *   text: string;
 *   textMuted: string;
 *   accent: string;
 *   success: string;
 *   warning: string;
 *   danger: string;
 *   info: string;
 * }>}
 *
 * AI-NOTE: `accent` must match web `statusColors.success` / `--c-accent`
 * (#10b981, emerald-500) so that Sergeant's brand accent is identical
 * cross-platform. Keep `success` / `warning` / `danger` / `info` aligned
 * with `statusColors` in `./tokens.js`.
 */
export const colors = Object.freeze({
  bg: "#0b0d10",
  surface: "#13161b",
  border: "#1f242c",
  text: "#f2f4f7",
  textMuted: "#8a94a6",
  accent: "#10b981",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  info: "#0ea5e9",
});

/** @type {Readonly<{ xs: number; sm: number; md: number; lg: number; xl: number; xxl: number; }>} */
export const spacing = Object.freeze({
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
});

/** @type {Readonly<{ sm: number; md: number; lg: number; xl: number; }>} */
export const radius = Object.freeze({
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
});
