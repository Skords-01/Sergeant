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
} from "../lib/nutritionStorage.js";
import { deleteMealThumbnail } from "../lib/mealPhotoStorage.js";

export function useNutritionLog() {
  const [nutritionLog, setNutritionLog] = useState(() => loadNutritionLog(NUTRITION_LOG_KEY));
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
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
    setNutritionLog(normalizeNutritionLog(parsed));
  }, []);

  const mergeLogFromJsonText = useCallback((text) => {
    const parsed = JSON.parse(text);
    setNutritionLog((log) => mergeNutritionLogs(log, parsed));
  }, []);

  const trimLogToLastDays = useCallback((keepDays) => {
    setNutritionLog((log) => trimLogOldestDays(log, keepDays));
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
