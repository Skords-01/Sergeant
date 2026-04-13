import { useCallback, useEffect, useMemo, useState } from "react";
import {
  parseWorkoutsFromStorage,
  serializeWorkoutsToStorage,
  WORKOUTS_STORAGE_KEY,
} from "../lib/fizrukStorage";

function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useWorkouts() {
  const [workouts, setWorkouts] = useState([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(WORKOUTS_STORAGE_KEY);
      const parsed = parseWorkoutsFromStorage(raw);
      if (Array.isArray(parsed)) setWorkouts(parsed);
    } catch {}
  }, []);

  const persist = useCallback((next) => {
    setWorkouts(next);
    try {
      localStorage.setItem(WORKOUTS_STORAGE_KEY, serializeWorkoutsToStorage(next));
    } catch {}
  }, []);

  const createWorkout = useCallback(() => {
    const w = {
      id: uid("w"),
      startedAt: new Date().toISOString(),
      endedAt: null,
      items: [],
      note: "",
    };
    persist([w, ...workouts]);
    return w;
  }, [persist, workouts]);

  const endWorkout = useCallback((id) => {
    const nowIso = new Date().toISOString();
    let ended = null;
    persist(workouts.map(w => {
      if (w.id !== id) return w;
      if (w.endedAt) {
        ended = w;
        return w;
      }
      ended = { ...w, endedAt: nowIso };
      return ended;
    }));
    return ended;
  }, [persist, workouts]);

  const updateWorkout = useCallback((id, patch) => {
    persist(workouts.map(w => w.id === id ? { ...w, ...patch } : w));
  }, [persist, workouts]);

  const deleteWorkout = useCallback((id) => {
    persist(workouts.filter(w => w.id !== id));
  }, [persist, workouts]);

  const addItem = useCallback((workoutId, item) => {
    persist(workouts.map(w => {
      if (w.id !== workoutId) return w;
      return { ...w, items: [{ id: uid("i"), ...item }, ...(w.items || [])] };
    }));
  }, [persist, workouts]);

  const updateItem = useCallback((workoutId, itemId, patch) => {
    persist(workouts.map(w => {
      if (w.id !== workoutId) return w;
      return {
        ...w,
        items: (w.items || []).map(i => i.id === itemId ? { ...i, ...patch } : i),
      };
    }));
  }, [persist, workouts]);

  const removeItem = useCallback((workoutId, itemId) => {
    persist(workouts.map(w => {
      if (w.id !== workoutId) return w;
      return { ...w, items: (w.items || []).filter(i => i.id !== itemId) };
    }));
  }, [persist, workouts]);

  const sorted = useMemo(() => {
    return [...workouts].sort((a, b) => (b.startedAt || "").localeCompare(a.startedAt || ""));
  }, [workouts]);

  return {
    workouts: sorted,
    createWorkout,
    updateWorkout,
    deleteWorkout,
    endWorkout,
    addItem,
    updateItem,
    removeItem,
  };
}
