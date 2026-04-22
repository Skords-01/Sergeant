/**
 * `useNutritionPrefs` — MMKV-backed read/write hook для nutrition prefs
 * (денні цілі КБЖВ, водна ціль, reminder-опції).
 *
 * PR-4 використовує це лише для читання (денні targets у Dashboard).
 * Запис prefs-форми через реальний settings-екран прилітає з PR-7/8.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { type NutritionPrefs } from "@sergeant/nutrition-domain";
import { STORAGE_KEYS } from "@sergeant/shared";

import { _getMMKVInstance } from "@/lib/storage";
import { enqueueChange } from "@/sync/enqueue";

import { loadNutritionPrefs, saveNutritionPrefs } from "../lib/nutritionStore";

export interface UseNutritionPrefsResult {
  prefs: NutritionPrefs;
  setPrefs: (next: NutritionPrefs) => void;
  updatePrefs: (patch: Partial<NutritionPrefs>) => void;
}

export function useNutritionPrefs(): UseNutritionPrefsResult {
  const [prefs, setPrefsState] = useState<NutritionPrefs>(() =>
    loadNutritionPrefs(),
  );

  const prefsRef = useRef(prefs);
  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);

  useEffect(() => {
    const mmkv = _getMMKVInstance();
    const sub = mmkv.addOnValueChangedListener((changedKey) => {
      if (changedKey === STORAGE_KEYS.NUTRITION_PREFS) {
        setPrefsState(loadNutritionPrefs());
      }
    });
    return () => sub.remove();
  }, []);

  const commit = useCallback((next: NutritionPrefs) => {
    setPrefsState(next);
    saveNutritionPrefs(next);
    enqueueChange(STORAGE_KEYS.NUTRITION_PREFS);
  }, []);

  const setPrefs = useCallback(
    (next: NutritionPrefs) => {
      commit(next);
    },
    [commit],
  );

  const updatePrefs = useCallback(
    (patch: Partial<NutritionPrefs>) => {
      commit({ ...prefsRef.current, ...patch });
    },
    [commit],
  );

  return { prefs, setPrefs, updatePrefs };
}
