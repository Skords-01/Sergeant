/**
 * Sergeant Routine — RoutineApp shell (React Native, first cut)
 *
 * Mobile port of `apps/web/src/modules/routine/RoutineApp.tsx` (728 LOC).
 *
 * Scope of this first cut (Phase 5 — PR 1):
 *  - Root shell wrapped in `ModuleErrorBoundary` with `moduleName="Рутина"`.
 *  - Bottom-nav segmented switcher for the 3 web tabs
 *    (`calendar` / `stats` / `settings`), active tab persisted in MMKV
 *    under the shared `STORAGE_KEYS.ROUTINE_MAIN_TAB` slot so state
 *    survives hot-reload / tab switches (parity with web's
 *    `localStorage.getItem(STORAGE_KEYS.ROUTINE_MAIN_TAB)`).
 *  - Three sub-tabs now host real screens:
 *    - `calendar` → `pages/Calendar.tsx` (live, PR #455);
 *    - `stats`    → `pages/Heatmap/HeatmapPage.tsx` (live, Heatmap PR);
 *    - `settings` → `pages/Habits/HabitsPage.tsx` (live, PR #463).
 *    Remaining Phase 5 follow-ups (reminders via expo-notifications,
 *    storage + CloudSync wiring) land in later PRs and do not touch
 *    this shell.
 *
 * Intentional differences from the web shell (see PR body):
 *  - No auth-guard at this level — the guard already lives in
 *    `app/(tabs)/_layout.tsx` (Redirect when `!data?.user`).
 *  - No `RoutineCalendarProvider` / `useRoutineReminders` / storage
 *    listeners yet — those are wired up in subsequent PRs that actually
 *    need them. Keeping the shell dependency-free means PR 1 cannot
 *    regress any existing behaviour.
 *  - No deep-link URL query-param parsing (`?routineDay=YYYY-MM-DD`) yet —
 *    the mobile equivalent lands with PR 3 once the calendar screen is
 *    real (uses `expo-linking` / `useLocalSearchParams`).
 *  - Persistence shape: web stores the raw string (`"calendar"` etc.);
 *    the MMKV adapter's `useLocalStorage` serialises to JSON. We
 *    explicitly validate the parsed value so a legacy un-stringified
 *    blob from a shared-key collision does not crash the shell.
 *  - In-component tab state (no expo-router Stack for sub-screens) —
 *    the web app is also a single-page component with in-component
 *    tabs + modal sheets for details. Future PRs that need push
 *    navigation (e.g. habit-detail route) can convert `routine.tsx` to
 *    a folder with `_layout.tsx` Stack without touching this file.
 */

import { useCallback, useState } from "react";
import { View } from "react-native";

import { STORAGE_KEYS } from "@sergeant/shared";
import { router } from "expo-router";

import ModuleErrorBoundary from "@/core/ModuleErrorBoundary";
import { safeReadStringLS, safeWriteLS } from "@/lib/storage";

import {
  RoutineBottomNav,
  type RoutineMainTab,
} from "./components/RoutineBottomNav";
import { useRoutineReminders } from "./hooks/useRoutineReminders";
import { useRoutineStore } from "./lib/routineStore";
import { Calendar } from "./pages/Calendar";
import { HabitsPage } from "./pages/Habits/HabitsPage";
import { HeatmapPage } from "./pages/Heatmap/HeatmapPage";

const TAB_PERSIST_KEY = STORAGE_KEYS.ROUTINE_MAIN_TAB;

function isRoutineMainTab(value: unknown): value is RoutineMainTab {
  return value === "calendar" || value === "stats" || value === "settings";
}

/**
 * Read the persisted tab directly as a raw string — web parity.
 *
 * The web app stores the tab via `localStorage.setItem(…, "calendar")`
 * and reads via `localStorage.getItem(…)`. Mobile's `useLocalStorage`
 * hook wraps JSON.parse/stringify which is asymmetric for plain strings
 * (`JSON.parse("stats")` throws). Rather than JSON-encode an enum the
 * web never encodes, we bypass the hook and treat the slot as raw text.
 */
function readPersistedTab(): RoutineMainTab {
  const raw = safeReadStringLS(TAB_PERSIST_KEY);
  return isRoutineMainTab(raw) ? raw : "calendar";
}

function RoutineShell() {
  const [mainTab, setMainTab] = useState<RoutineMainTab>(readPersistedTab);

  // Subscribe to the routine store so the reminder scheduler sees
  // live habit edits without us re-reading MMKV on every change.
  // The hook itself only fires schedule/cancel work when permission
  // is `granted` — on first mount it only calls
  // `Notifications.getPermissionsAsync()`, never the permission
  // prompt (see `useRoutineReminders.ts`).
  const { routine } = useRoutineStore();
  useRoutineReminders(routine);

  const handleSelectTab = useCallback((next: RoutineMainTab) => {
    setMainTab(next);
    // Raw-string write keeps the persisted value parseable on the next
    // mount (`JSON.parse("calendar")` would throw).
    safeWriteLS(TAB_PERSIST_KEY, next);
  }, []);

  return (
    <View className="flex-1 bg-cream-50">
      <View className="flex-1">
        {mainTab === "calendar" ? <Calendar /> : null}
        {mainTab === "stats" ? <HeatmapPage /> : null}
        {mainTab === "settings" ? <HabitsPage /> : null}
      </View>

      <RoutineBottomNav mainTab={mainTab} onSelectTab={handleSelectTab} />
    </View>
  );
}

/**
 * RoutineApp — public entry for the mobile Routine module.
 *
 * Wraps the shell in a per-module `ModuleErrorBoundary` so a render
 * crash inside any sub-screen is isolated to this tab. `onBackToHub`
 * points to the Hub tab (`/`) via `expo-router` — matches the behaviour
 * of the web `onBackToHub` prop which is wired to the Hub module from
 * `core/App.tsx`.
 */
export function RoutineApp() {
  const handleBackToHub = useCallback(() => {
    try {
      router.replace("/");
    } catch {
      /* noop — navigation is best-effort after a module crash */
    }
  }, []);

  return (
    <ModuleErrorBoundary moduleName="Рутина" onBackToHub={handleBackToHub}>
      <RoutineShell />
    </ModuleErrorBoundary>
  );
}

export default RoutineApp;
