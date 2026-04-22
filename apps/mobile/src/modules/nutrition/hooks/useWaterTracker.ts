/**
 * `useWaterTracker` — MMKV-backed React hook для щоденного трекера води.
 * Mirror `apps/web/src/modules/nutrition/hooks/useWaterTracker.ts`.
 *
 * Вся чиста логіка (`addWaterMl` / `getTodayWaterMl` / `resetTodayWater`)
 * живе у `@sergeant/nutrition-domain` → web і native отримують ту саму
 * семантику.
 *
 * Water key не входить до `SYNC_MODULES.nutrition` на mobile, бо web
 * історично також не синкає воду (див.
 * `apps/web/src/core/cloudSync/config.ts`). Це свідомо — вода суто
 * локальний трекер. Якщо передумаємо, достатньо буде додати
 * `WATER_LOG_KEY` у конфіг і викликати `enqueueChange(WATER_LOG_KEY)`
 * після commit.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import {
  addWaterMl,
  getTodayWaterMl,
  resetTodayWater,
  type WaterLog,
} from "@sergeant/nutrition-domain";

import { loadWaterLog, saveWaterLog } from "../lib/nutritionStore";

export interface UseWaterTrackerResult {
  todayMl: number;
  add: (ml: number) => void;
  reset: () => void;
}

export function useWaterTracker(): UseWaterTrackerResult {
  const [log, setLog] = useState<WaterLog>(() => loadWaterLog());

  const logRef = useRef(log);
  useEffect(() => {
    logRef.current = log;
  }, [log]);

  const commit = useCallback((next: WaterLog) => {
    setLog(next);
    saveWaterLog(next);
  }, []);

  const todayMl = getTodayWaterMl(log);

  const add = useCallback(
    (ml: number) => {
      commit(addWaterMl(logRef.current, ml));
    },
    [commit],
  );

  const reset = useCallback(() => {
    commit(resetTodayWater(logRef.current));
  }, [commit]);

  return { todayMl, add, reset };
}
