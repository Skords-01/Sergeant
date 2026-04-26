/**
 * Sergeant Design Tokens — shared TypeScript types.
 *
 * Single source of truth for module/semantic/brand identifiers used across
 * web, mobile, and shared packages. Component-level redefinitions of these
 * unions should be removed in favour of these exports.
 */

/** Module accent identifiers — one per product domain. */
export type ModuleAccent = "finyk" | "fizruk" | "routine" | "nutrition";

/** Soft (tinted-surface) variants of module accents. */
export type ModuleSoftAccent =
  | "finyk-soft"
  | "fizruk-soft"
  | "routine-soft"
  | "nutrition-soft";

/** Status / semantic colour identifiers used for feedback UI. */
export type StatusColor = "success" | "warning" | "danger" | "info";

/** Semantic tone for neutral/feedback components (no `info`). */
export type SemanticTone = "default" | "success" | "warning" | "danger";

/**
 * Union of semantic tones and module accents.
 * Useful for components that can be themed either by feedback tone
 * (e.g. `success`) or by module identity (e.g. `finyk`).
 */
export type SemanticOrModuleTone = SemanticTone | ModuleAccent;

/** Primary brand colour ramps exposed by `brandColors` in tokens.js. */
export type BrandColor = "emerald" | "teal" | "cream" | "coral" | "lime";

// ─── Runtime token shapes ────────────────────────────────────────────────

type ColorRamp = Readonly<Record<string, string>>;

/** Brand colour ramps. Mirrors `brandColors` in `tokens.js`. */
export declare const brandColors: Readonly<Record<BrandColor, ColorRamp>>;

/** Chart segment palette (1..N) — soft organic colours for pie charts. */
export declare const chartPalette: Readonly<Record<string, string>>;

/** Ordered list view of `chartPalette` values. */
export declare const chartPaletteList: readonly string[];

/** Module-specific accent colours keyed by module identifier. */
export declare const moduleColors: Readonly<
  Record<ModuleAccent, Readonly<Record<string, string>>>
>;

/** Status / semantic colours, keyed by `StatusColor`. */
export declare const statusColors: Readonly<Record<StatusColor, string>>;

/**
 * Status colours as a flat hex map — alias of `statusColors` for inline
 * SVG / canvas / native call sites that consume raw `"#rrggbb"` strings.
 */
export declare const statusHex: Readonly<Record<StatusColor, string>>;

/** Semantic chart colour identifiers (kcal/protein/fat/carbs + structural). */
export type ChartHexKey =
  | "primary"
  | "limit"
  | "neutral"
  | "kcal"
  | "protein"
  | "fat"
  | "carbs";

/** Chart hex tokens — semantic names for inline-styled chart primitives. */
export declare const chartHex: Readonly<Record<ChartHexKey, string>>;
