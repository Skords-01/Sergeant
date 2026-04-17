import { useCallback, useEffect, useState } from "react";
import {
  loadWaterLog,
  saveWaterLog,
  getTodayWaterMl,
  addWaterMl,
  resetTodayWater,
} from "../lib/waterStorage.js";

export function useWaterTracker() {
  const [log, setLog] = useState(() => loadWaterLog());

  useEffect(() => {
    saveWaterLog(log);
  }, [log]);

  const todayMl = getTodayWaterMl(log);

  const add = useCallback((ml) => {
    setLog((prev) => addWaterMl(prev, ml));
  }, []);

  const reset = useCallback(() => {
    setLog((prev) => resetTodayWater(prev));
  }, []);

  return { todayMl, add, reset };
}
