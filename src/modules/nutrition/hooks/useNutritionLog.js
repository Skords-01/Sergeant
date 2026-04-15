import { useCallback, useEffect, useState } from "react";
import {
  NUTRITION_LOG_KEY,
  loadNutritionLog,
  persistNutritionLog,
  addLogEntry,
  removeLogEntry,
  duplicatePreviousDayMeals,
  mergeNutritionLogs,
  normalizeNutritionLog,
  trimLogOldestDays,
  toLocalISODate,
} from "../lib/nutritionStorage.js";
import { deleteMealThumbnail, gcMealThumbnails } from "../lib/mealPhotoStorage.js";

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

export function useNutritionLog() {
  const [nutritionLog, setNutritionLog] = useState(() => loadNutritionLog(NUTRITION_LOG_KEY));
  const [selectedDate, setSelectedDate] = useState(() => toLocalISODate(new Date()));
  const [addMealSheetOpen, setAddMealSheetOpen] = useState(false);
  const [addMealPhotoResult, setAddMealPhotoResult] = useState(null);
  const [storageErr, setStorageErr] = useState("");

  useEffect(() => {
    const ok = persistNutritionLog(nutritionLog, NUTRITION_LOG_KEY);
    setStorageErr(
      ok ? "" : "Не вдалося зберегти журнал (переповнення сховища або приватний режим).",
    );
  }, [nutritionLog]);

  const handleAddMeal = (meal) => {
    setNutritionLog((log) => addLogEntry(log, selectedDate, meal));
    setAddMealSheetOpen(false);
    setAddMealPhotoResult(null);
  };

  const handleRemoveMeal = (date, id) => {
    void deleteMealThumbnail(id);
    setNutritionLog((log) => removeLogEntry(log, date, id));
  };

  const duplicateYesterday = useCallback(() => {
    setNutritionLog((log) => duplicatePreviousDayMeals(log, selectedDate));
  }, [selectedDate]);

  const replaceLogFromJsonText = useCallback((text) => {
    const parsed = JSON.parse(text);
    setNutritionLog((prev) => {
      const next = normalizeNutritionLog(parsed);
      const keep = collectMealIds(next);
      void gcMealThumbnails(keep, { maxDeletes: 2000 });
      return next;
    });
  }, []);

  const mergeLogFromJsonText = useCallback((text) => {
    const parsed = JSON.parse(text);
    setNutritionLog((log) => mergeNutritionLogs(log, parsed));
  }, []);

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
    handleRemoveMeal,
    storageErr,
    duplicateYesterday,
    replaceLogFromJsonText,
    mergeLogFromJsonText,
    trimLogToLastDays,
  };
}
