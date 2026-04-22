/**
 * Sergeant Nutrition — NutritionApp shell (React Native, first cut)
 *
 * Mobile port of `apps/web/src/modules/nutrition/NutritionApp.tsx` (581 LOC).
 *
 * Scope of PR-4:
 *  - Замінює `ModuleStub` на реальну shell-обгортку з
 *    `ModuleErrorBoundary` (моdule-name = "Харчування") + bottom-nav з
 *    трьома вкладками (`dashboard` / `log` / `water`).
 *  - Вкладка "Сьогодні" (`dashboard`) → `pages/Dashboard.tsx` (macros +
 *    week-bar + water).
 *  - Вкладка "Журнал" (`log`) → `pages/Log.tsx` — read-only список
 *    прийомів за вибрану дату з date-switcher.
 *  - Вкладка "Вода" (`water`) → `pages/Water.tsx` — дубль водного картка
 *    для швидкого доступу.
 *
 * Що навмисно відсутнє у PR-4 (чекає наступні PR-и):
 *  - AddMealSheet / ItemEditSheet — PR-5. Дотик на "Сьогодні → +Додати" та
 *    длинне натискання в журналі в цьому PR залишаються без дії; простір
 *    під них зарезервовано у Dashboard/Log коментарями.
 *  - Barcode scanner — PR-6 (`apps/mobile/app/(tabs)/nutrition/scan.tsx`
 *    ще рендерить stub-деф-скрін; він перехопить контроль коли в
 *    sheet-і з'явиться кнопка "Сканер").
 *  - Pantry / ShoppingList — PR-7. Вкладки в bottom-nav додадуться коли
 *    логіка приземлиться.
 *  - AI-фічі (photo analyze / day plan / recipes) — PR-8.
 *  - Reminders / cloud backup — PR-9.
 *
 * Persistence:
 *  - Активна вкладка зберігається у MMKV за ключем
 *    `STORAGE_KEYS.NUTRITION_MAIN_TAB` (raw string, as зроблено у Routine).
 */
import { useCallback, useState } from "react";
import { View } from "react-native";

import { STORAGE_KEYS } from "@sergeant/shared";
import { router } from "expo-router";

import ModuleErrorBoundary from "@/core/ModuleErrorBoundary";
import { safeReadStringLS, safeWriteLS } from "@/lib/storage";

import {
  NutritionBottomNav,
  type NutritionMainTab,
} from "./components/NutritionBottomNav";
import { Dashboard } from "./pages/Dashboard";
import { Log } from "./pages/Log";
import { Water } from "./pages/Water";

const TAB_PERSIST_KEY = STORAGE_KEYS.NUTRITION_MAIN_TAB;

function isNutritionMainTab(value: unknown): value is NutritionMainTab {
  return value === "dashboard" || value === "log" || value === "water";
}

function readPersistedTab(): NutritionMainTab {
  const raw = safeReadStringLS(TAB_PERSIST_KEY);
  return isNutritionMainTab(raw) ? raw : "dashboard";
}

function NutritionShell() {
  const [mainTab, setMainTab] = useState<NutritionMainTab>(readPersistedTab);

  const handleSelectTab = useCallback((next: NutritionMainTab) => {
    setMainTab(next);
    safeWriteLS(TAB_PERSIST_KEY, next);
  }, []);

  return (
    <View className="flex-1 bg-cream-50" testID="nutrition-shell">
      <View className="flex-1">
        {mainTab === "dashboard" ? (
          <Dashboard testID="nutrition-dashboard" />
        ) : null}
        {mainTab === "log" ? <Log testID="nutrition-log" /> : null}
        {mainTab === "water" ? <Water testID="nutrition-water" /> : null}
      </View>

      <NutritionBottomNav
        mainTab={mainTab}
        onSelectTab={handleSelectTab}
        testID="nutrition-bottom-nav"
      />
    </View>
  );
}

/**
 * NutritionApp — public entry для модуля Харчування (mobile).
 *
 * Wrap у `ModuleErrorBoundary` — якщо краш в будь-якій вкладці, він
 * ізольований у Nutrition-табі. `onBackToHub` веде на Hub-таб (`/`)
 * через `expo-router` — mirror web-поведінки.
 */
export function NutritionApp() {
  const handleBackToHub = useCallback(() => {
    try {
      router.replace("/");
    } catch {
      /* noop — best-effort navigation after module crash */
    }
  }, []);

  return (
    <ModuleErrorBoundary moduleName="Харчування" onBackToHub={handleBackToHub}>
      <NutritionShell />
    </ModuleErrorBoundary>
  );
}

export default NutritionApp;
