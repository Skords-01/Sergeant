/**
 * Bottom-nav catalogue for Fizruk (React Native).
 *
 * Mirrors `apps/web/src/modules/fizruk/shell/fizrukNav.tsx` — same 4
 * primary entries (`dashboard`, `workouts`, `plan`, `body`). On web
 * these ids drive the hash router; on mobile they drive Expo Router
 * segment pushes.
 *
 * Icons are kept as short unicode glyphs in this first cut so the
 * scaffolding can ship without a new icon dependency. A follow-up PR
 * will replace them with `react-native-svg` ports of the web SVGs
 * (same stroke geometry).
 */

import type { FizrukPage } from "./fizrukRoute";

export interface FizrukNavItem {
  id: Extract<FizrukPage, "dashboard" | "workouts" | "plan" | "body">;
  label: string;
  glyph: string;
}

export const FIZRUK_NAV: readonly FizrukNavItem[] = [
  { id: "dashboard", label: "Сьогодні", glyph: "🕒" },
  { id: "workouts", label: "Тренування", glyph: "💪" },
  { id: "plan", label: "План", glyph: "📅" },
  { id: "body", label: "Тіло", glyph: "🫀" },
] as const;
