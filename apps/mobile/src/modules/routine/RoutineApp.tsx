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
 *  - Three sub-tabs render `<RoutineTabPlaceholder>` cards with a
 *    "Скоро — буде портовано" label and the same `emoji + title` shape
 *    as the final screens will have. This mirrors the Phase 2
 *    `HubSettingsPage` shell pattern (see PR #443) — the visual
 *    hierarchy is final; content is filled in by subsequent Phase 5 PRs:
 *    - PR 3 → `Календар` (react-native-calendars / custom FlashList grid);
 *    - PR 4 → `Habits list` (swipe-dismiss + reorder);
 *    - PR 5 → `Heatmap` (react-native-svg + FlashList);
 *    - PR 6 → `Reminders` (expo-notifications scheduled);
 *    - PR 7 → `Storage + CloudSync` wiring.
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
import { RoutineTabPlaceholder } from "./components/RoutineTabPlaceholder";

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

  const handleSelectTab = useCallback((next: RoutineMainTab) => {
    setMainTab(next);
    // Raw-string write keeps the persisted value parseable on the next
    // mount (`JSON.parse("calendar")` would throw).
    safeWriteLS(TAB_PERSIST_KEY, next);
  }, []);

  return (
    <View className="flex-1 bg-cream-50">
      <View className="flex-1">
        {mainTab === "calendar" ? (
          <RoutineTabPlaceholder
            title="Календар"
            emoji="📅"
            description="Хаб-календар рутини: звички, день, тиждень, місяць. Скоро — з підсвіткою планових тренувань Фізрука та платежів Фініка."
            plannedFeatures={[
              "Місячна сітка з бейджами подій по дню",
              "Тижнева стрічка з прогрес-рингом",
              "Список звичок на обраний день з тап-відміткою",
              "Перегляд деталей дня у bottom-sheet",
            ]}
          />
        ) : null}
        {mainTab === "stats" ? (
          <RoutineTabPlaceholder
            title="Статистика"
            emoji="📊"
            description="Хітмеп виконання, стріки та топ-звички. Порт у наступних PR-ах Фази 5."
            plannedFeatures={[
              "Heatmap виконання звичок (react-native-svg)",
              "Лідери і аутсайдери серед активних звичок",
              "Відсоток виконаних по діапазонах (тиждень / місяць / рік)",
              "Детальний лист звички (історія, стрік, нотатки)",
            ]}
          />
        ) : null}
        {mainTab === "settings" ? (
          <RoutineTabPlaceholder
            title="Налаштування"
            emoji="⚙️"
            description="Керування звичками, категоріями, тегами та нагадуваннями. Повний порт у наступних PR-ах Фази 5."
            plannedFeatures={[
              "Список активних звичок з reorder + swipe-dismiss",
              "Форма створення/редагування звички (розклад, час, теги)",
              "Категорії та теги (CRUD)",
              "Архів звичок",
              "Пресети нагадувань через expo-notifications",
            ]}
          />
        ) : null}
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
