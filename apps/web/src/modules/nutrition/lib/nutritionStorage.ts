/**
 * Web I/O-адаптер для модуля Харчування: prefs, pantries, log.
 *
 * Pure-логіка (normalize/default/mutation-хелпери + типи + LS-ключі) живе
 * у `@sergeant/nutrition-domain` і спільна з `apps/mobile`. Тут лишаються
 * лише `load*`/`persist*` поверх `createModuleStorage` і реекспорти
 * старої поверхні цього модуля, щоб існуючі `../lib/nutritionStorage.js`
 * імпорти всередині `apps/web` не довелось переписувати.
 */
import {
  NUTRITION_ACTIVE_PANTRY_KEY,
  NUTRITION_LOG_KEY,
  NUTRITION_PANTRIES_KEY,
  NUTRITION_PREFS_KEY,
  defaultNutritionPrefs,
  makeDefaultPantry,
  normalizeNutritionLog,
  normalizeNutritionPrefs,
  normalizePantries,
  type NutritionLog,
  type NutritionPrefs,
  type Pantry,
} from "@sergeant/nutrition-domain";

import { nutritionStorage } from "./nutritionStorageInstance.js";

export {
  NUTRITION_ACTIVE_PANTRY_KEY,
  NUTRITION_LOG_KEY,
  NUTRITION_PANTRIES_KEY,
  NUTRITION_PREFS_KEY,
  addDaysISODate,
  addLogEntry,
  defaultNutritionPrefs,
  duplicatePreviousDayMeals,
  estimateLogBytes,
  getDayMacros,
  getDaySummary,
  getMacrosForDateRange,
  makeDefaultPantry,
  mergeNutritionLogs,
  normalizeMeal,
  normalizeNutritionLog,
  normalizePantries,
  removeLogEntry,
  searchMealsByName,
  trimLogOldestDays,
  updateLogEntry,
  updatePantry,
} from "@sergeant/nutrition-domain";
export { toLocalISODate } from "@sergeant/shared";
export type {
  DaySummary,
  MacrosRow,
  Meal,
  MealMacroSource,
  MealSearchResult,
  MealSource,
  MealTemplate,
  NutritionDay,
  NutritionGoal,
  NutritionLog,
  NutritionLogLike,
  NutritionPrefs,
  Pantry,
} from "@sergeant/nutrition-domain";

// ─────────────────────────────────────────────
// I/O wrappers (createModuleStorage / localStorage)
// ─────────────────────────────────────────────

export function loadNutritionPrefs(
  key: string = NUTRITION_PREFS_KEY,
): NutritionPrefs {
  return normalizeNutritionPrefs(nutritionStorage.readJSON(key, null));
}

export function persistNutritionPrefs(
  prefs: NutritionPrefs | null | undefined,
  key: string = NUTRITION_PREFS_KEY,
): boolean {
  return nutritionStorage.writeJSON(key, prefs || defaultNutritionPrefs());
}

export function loadActivePantryId(
  activeKey: string = NUTRITION_ACTIVE_PANTRY_KEY,
): string {
  const v = nutritionStorage.readRaw(activeKey, null);
  return v ? String(v) : "home";
}

export function loadPantries(
  key: string = NUTRITION_PANTRIES_KEY,
  activeKey: string = NUTRITION_ACTIVE_PANTRY_KEY,
): Pantry[] {
  const parsed = nutritionStorage.readJSON(key, null);
  const normalized = normalizePantries(parsed);
  if (normalized.length > 0) return normalized;

  // Legacy v0 pantry migration is handled by storageManager
  // (nutrition_001_migrate_legacy_pantry). By the time this code runs after
  // app boot, the v1 key already has data if any v0 data existed.
  const fallback = makeDefaultPantry();
  nutritionStorage.writeRaw(activeKey, fallback.id);
  return [fallback];
}

export function persistPantries(
  key: string = NUTRITION_PANTRIES_KEY,
  activeKey: string = NUTRITION_ACTIVE_PANTRY_KEY,
  pantries?: Pantry[] | null,
  activeId?: string | null,
): boolean {
  const a = nutritionStorage.writeJSON(
    key,
    Array.isArray(pantries) ? pantries : [],
  );
  const b = activeId
    ? nutritionStorage.writeRaw(activeKey, String(activeId))
    : true;
  return a && b;
}

export function loadNutritionLog(
  key: string = NUTRITION_LOG_KEY,
): NutritionLog {
  const parsed = nutritionStorage.readJSON(key, null);
  return normalizeNutritionLog(parsed);
}

export function persistNutritionLog(
  log: NutritionLog | null | undefined,
  key: string = NUTRITION_LOG_KEY,
): boolean {
  return nutritionStorage.writeJSON(key, log || {});
}
