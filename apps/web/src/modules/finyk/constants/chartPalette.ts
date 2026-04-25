/**
 * Re-export of shared Sergeant design tokens for convenient access from
 * inside the web app. The authoritative source of truth lives in
 * `@sergeant/design-tokens/tokens`; this file exists so existing
 * imports from `./constants/chartPalette` keep working and to preserve
 * the documented design philosophy comment alongside web-only code.
 *
 * Design Philosophy:
 * - Warm, friendly, approachable colors inspired by Duolingo/Yazio/Monobank
 * - Soft pastels with rich saturated accents
 * - Each color has semantic meaning in the app context
 */

export {
  brandColors,
  chartPalette,
  chartPaletteList,
  moduleColors,
  statusColors,
} from "@sergeant/design-tokens/tokens";
