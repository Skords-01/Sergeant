/**
 * FizrukApp — mobile RN-root for the Fizruk module (Phase 6 / PR-1).
 *
 * Web counterpart: `apps/web/src/modules/fizruk/FizrukApp.tsx` (129 LOC).
 *
 * The web shell does three things: hash-router, cross-page hooks
 * (workouts, templates, program, monthly plan), and a `ModuleShell`
 * chrome (header + bottom-nav + settings drawer). On mobile those
 * responsibilities split across Expo Router:
 *
 *   - Routing is file-based (`apps/mobile/app/(tabs)/fizruk/*.tsx`).
 *     `Stack` lives in `_layout.tsx` and each screen file is a leaf.
 *   - Cross-page hooks (workouts / templates / monthly plan) land in
 *     follow-up PRs alongside the hooks they feed.
 *   - The header / settings-drawer / ModuleShell chrome lands together
 *     with WorkoutBackupBar in a later PR.
 *
 * This first cut therefore exports nothing beyond the `Dashboard`
 * screen — the index-route wrapper that the stack pushes when the tab
 * is focused. Naming the file `FizrukApp` keeps the one-to-one mapping
 * with the web module so reviewers can diff-check conventions.
 */

export {
  Dashboard as default,
  Dashboard as FizrukApp,
} from "./pages/Dashboard";
