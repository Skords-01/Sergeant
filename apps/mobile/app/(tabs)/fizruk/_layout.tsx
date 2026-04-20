/**
 * Fizruk nested Stack navigator (Expo Router).
 *
 * Hosts the 9 Fizruk pages that were a single hash router on web:
 *
 *   - `index`        → Dashboard (root of the stack)
 *   - `workouts`     → Workouts list + active-session shell
 *   - `exercise`     → Exercise detail (will accept `?id=` in a follow-up)
 *   - `programs`     → Program catalogue
 *   - `progress`     → Charts + photo progress + backup
 *   - `measurements` → Body measurements input
 *   - `body`         → Body dashboard
 *   - `atlas`        → Full-screen body atlas
 *   - `plan`         → Monthly plan calendar
 *
 * All screens render header-less for now — the per-screen titles are
 * rendered inline (first heading of each screen). This keeps visual
 * parity with the web `ModuleShell`, where each page owned its title.
 * A later PR brings the shared `FizrukHeader` + settings drawer.
 */

import { Stack } from "expo-router";

export default function FizrukStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
