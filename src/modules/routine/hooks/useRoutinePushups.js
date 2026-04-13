import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addPushupReps,
  loadRoutineState,
  ROUTINE_EVENT,
} from "../lib/routineStorage.js";
import { dateKeyFromDate } from "../lib/hubCalendarAggregate.js";

const HISTORY_DAYS = 30;

function buildHistory(pushupsByDate, days) {
  const data =
    pushupsByDate && typeof pushupsByDate === "object" ? pushupsByDate : {};
  const result = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const str = d.toISOString().slice(0, 10);
    result.push({ date: str, total: data[str] ?? 0 });
  }
  return result;
}

export function useRoutinePushups() {
  const [state, setState] = useState(() => loadRoutineState());

  useEffect(() => {
    const sync = () => setState(loadRoutineState());
    window.addEventListener(ROUTINE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(ROUTINE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const today = dateKeyFromDate(new Date());
  const data = useMemo(
    () =>
      state.pushupsByDate && typeof state.pushupsByDate === "object"
        ? state.pushupsByDate
        : {},
    [state.pushupsByDate],
  );
  const todayCount = data[today] ?? 0;

  const addReps = useCallback((reps) => {
    setState((prev) => addPushupReps(prev, reps));
  }, []);

  const history = useMemo(() => buildHistory(data, HISTORY_DAYS), [data]);
  const recentHistory = useMemo(() => history.slice(-7), [history]);

  return { todayCount, addReps, history, recentHistory };
}
