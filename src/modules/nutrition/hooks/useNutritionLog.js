import { useCallback, useEffect, useRef, useState } from "react";
import {
  NUTRITION_LOG_KEY,
  loadNutritionLog,
  persistNutritionLog,
  addLogEntry,
  removeLogEntry,
  updateLogEntry,
  duplicatePreviousDayMeals,
  mergeNutritionLogs,
  normalizeNutritionLog,
  trimLogOldestDays,
  toLocalISODate,
} from "../lib/nutritionStorage.js";
import {
  deleteMealThumbnail,
  gcMealThumbnails,
} from "../lib/mealPhotoStorage.js";

/**
 * @typedef {{ kcal: number|null, protein_g: number|null, fat_g: number|null, carbs_g: number|null }} NullableMacros
 */

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   time: string,
 *   mealType: string,
 *   label: string,
 *   macros: NullableMacros,
 *   source: 'manual'|'photo',
 *   macroSource: 'manual'|'productDb'|'photoAI'|'recipeAI',
 *   amount_g?: number|null,
 *   foodId?: string|null,
 * }} Meal
 */

/**
 * @typedef {{ meals: Meal[] }} DayLog
 */

/**
 * @typedef {Record<string, DayLog>} NutritionLog
 * The full nutrition log keyed by ISO date string ("YYYY-MM-DD").
 */

/**
 * Collect all meal IDs present in a log.
 * @param {NutritionLog} log
 * @returns {Set<string>}
 */
function collectMealIds(log) {
  const out = new Set();
  for (const day of Object.values(log || {})) {
    const meals = Array.isArray(day?.meals) ? day.meals : [];
    for (const m of meals) {
      const id = m?.id;
      if (id) out.add(String(id));
    }
  }
  return out;
}

/**
 * Hook for managing the nutrition log and selected date.
 * Automatically persists the log to localStorage on each change.
 *
 * @returns {{
 *   nutritionLog: NutritionLog,
 *   setNutritionLog: (log: NutritionLog) => void,
 *   selectedDate: string,
 *   setSelectedDate: (date: string) => void,
 *   addMealSheetOpen: boolean,
 *   setAddMealSheetOpen: (open: boolean) => void,
 *   addMealPhotoResult: unknown,
 *   setAddMealPhotoResult: (result: unknown) => void,
 *   handleAddMeal: (meal: Partial<Meal>) => void,
 *   handleEditMeal: (date: string, meal: Partial<Meal> & { id: string }) => void,
 *   handleRemoveMeal: (date: string, id: string) => void,
 *   handleRestoreMeal: (date: string, meal: Partial<Meal> & { id: string }) => void,
 *   storageErr: string,
 *   duplicateYesterday: () => void,
 *   replaceLogFromJsonText: (text: string) => void,
 *   mergeLogFromJsonText: (text: string) => void,
 *   trimLogToLastDays: (keepDays: number) => void,
 * }}
 */
export function useNutritionLog() {
  const [nutritionLog, setNutritionLog] = useState(() =>
    loadNutritionLog(NUTRITION_LOG_KEY),
  );
  const [selectedDate, setSelectedDate] = useState(() =>
    toLocalISODate(new Date()),
  );
  const [addMealSheetOpen, setAddMealSheetOpen] = useState(false);
  const [addMealPhotoResult, setAddMealPhotoResult] = useState(null);
  const [storageErr, setStorageErr] = useState("");
  const pendingThumbDeletesRef = useRef(new Map());

  useEffect(() => {
    const ok = persistNutritionLog(nutritionLog, NUTRITION_LOG_KEY);
    setStorageErr(
      ok
        ? ""
        : "Не вдалося зберегти журнал (переповнення сховища або приватний режим).",
    );
  }, [nutritionLog]);

  /**
   * Add a meal to the currently selected date and close the add-meal sheet.
   * @param {Partial<Meal>} meal
   */
  const handleAddMeal = (meal) => {
    setNutritionLog((log) => addLogEntry(log, selectedDate, meal));
    setAddMealSheetOpen(false);
    setAddMealPhotoResult(null);
  };

  const handleEditMeal = (date, meal) => {
    if (!meal?.id) return;
    setNutritionLog((log) => updateLogEntry(log, date, meal));
    setAddMealSheetOpen(false);
    setAddMealPhotoResult(null);
  };

  /**
   * Remove a meal entry by date and ID and delete its photo thumbnail if any.
   * @param {string} date - ISO date string.
   * @param {string} id   - Meal ID.
   */
  const handleRemoveMeal = (date, idOrMeal) => {
    const id =
      typeof idOrMeal === "string" ? idOrMeal : String(idOrMeal?.id || "");
    if (!id) return;
    const existingTimer = pendingThumbDeletesRef.current.get(id);
    if (existingTimer) clearTimeout(existingTimer);
    const t = setTimeout(() => {
      pendingThumbDeletesRef.current.delete(id);
      void deleteMealThumbnail(id);
    }, 6000);
    pendingThumbDeletesRef.current.set(id, t);
    setNutritionLog((log) => removeLogEntry(log, date, id));
  };

  const handleRestoreMeal = (date, meal) => {
    const id = String(meal?.id || "");
    if (!id) return;
    const t = pendingThumbDeletesRef.current.get(id);
    if (t) {
      clearTimeout(t);
      pendingThumbDeletesRef.current.delete(id);
    }
    setNutritionLog((log) => addLogEntry(log, date, meal));
  };

  /**
   * Copy all meals from the previous day into the currently selected date.
   */
  const duplicateYesterday = useCallback(() => {
    setNutritionLog((log) => duplicatePreviousDayMeals(log, selectedDate));
  }, [selectedDate]);

  /**
   * Replace the entire log with data parsed from a JSON string.
   * Garbage-collects orphaned photo thumbnails.
   * Returns `false` on malformed JSON instead of throwing, so the UI
   * can show an import-failure toast without unmounting.
   * @param {string} text - JSON string of a full `NutritionLog`.
   * @returns {boolean}
   */
  const replaceLogFromJsonText = useCallback((text) => {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      console.error("[nutrition] replaceLogFromJsonText: invalid JSON", err);
      return false;
    }
    setNutritionLog((_prev) => {
      const next = normalizeNutritionLog(parsed);
      const keep = collectMealIds(next);
      void gcMealThumbnails(keep, { maxDeletes: 2000 });
      return next;
    });
    return true;
  }, []);

  /**
   * Merge data from a JSON string into the existing log.
   * Existing meals are preserved; imported meals are appended.
   * Returns `false` on malformed JSON instead of throwing.
   * @param {string} text - JSON string of a `NutritionLog` to merge.
   * @returns {boolean}
   */
  const mergeLogFromJsonText = useCallback((text) => {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      console.error("[nutrition] mergeLogFromJsonText: invalid JSON", err);
      return false;
    }
    setNutritionLog((log) => mergeNutritionLogs(log, parsed));
    return true;
  }, []);

  /**
   * Trim the log to the most recent `keepDays` calendar days.
   * Garbage-collects photo thumbnails for removed entries.
   * @param {number} keepDays - Number of most-recent days to keep.
   */
  const trimLogToLastDays = useCallback((keepDays) => {
    setNutritionLog((prev) => {
      const next = trimLogOldestDays(prev, keepDays);
      const keep = collectMealIds(next);
      void gcMealThumbnails(keep, { maxDeletes: 2000 });
      return next;
    });
  }, []);

  return {
    nutritionLog,
    setNutritionLog,
    selectedDate,
    setSelectedDate,
    addMealSheetOpen,
    setAddMealSheetOpen,
    addMealPhotoResult,
    setAddMealPhotoResult,
    handleAddMeal,
    handleEditMeal,
    handleRemoveMeal,
    handleRestoreMeal,
    storageErr,
    duplicateYesterday,
    replaceLogFromJsonText,
    mergeLogFromJsonText,
    trimLogToLastDays,
  };
}
