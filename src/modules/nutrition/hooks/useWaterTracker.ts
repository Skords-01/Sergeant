import { useCallback, useEffect, useState } from "react";
import {
  loadWaterLog,
  saveWaterLog,
  getTodayWaterMl,
  addWaterMl,
  resetTodayWater,
  type WaterLog,
} from "../lib/waterStorage.js";

export interface UseWaterTrackerResult {
  todayMl: number;
  add: (ml: number) => void;
  reset: () => void;
}

export function useWaterTracker(): UseWaterTrackerResult {
  const [log, setLog] = useState<WaterLog>(() => loadWaterLog());

  useEffect(() => {
    saveWaterLog(log);
  }, [log]);

  const todayMl = getTodayWaterMl(log);

  const add = useCallback((ml: number) => {
    setLog((prev) => addWaterMl(prev, ml));
  }, []);

  const reset = useCallback(() => {
    setLog((prev) => resetTodayWater(prev));
  }, []);

  return { todayMl, add, reset };
}
