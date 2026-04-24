/**
 * Sergeant Nutrition — NutritionApp shell (React Native)
 *
 * Mobile port of `apps/web/src/modules/nutrition/NutritionApp.tsx`.
 *
 * Зараз:
 *  - `ModuleErrorBoundary` + bottom-nav: `dashboard` / `log` / `water`.
 *  - `Dashboard` / `Log` / `Water` — див. `pages/`.
 *  - `AddMealSheet` — ручний ввід + перехід на
 *    `app/(tabs)/nutrition/scan` (expo-camera + `/api/barcode`, PR-6).
 * Далі: pantry / shopping, рецепти, deep link `recipe/[id]`, photo-AI (PR-7+).
 *
 * Persistence: активна вкладка — `STORAGE_KEYS.NUTRITION_MAIN_TAB` (MMKV).
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
