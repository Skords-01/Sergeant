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

  const persist = useCallback((nextOrUpdater) => {
    setWorkouts((prev) => {
      const next =
        typeof nextOrUpdater === "function"
          ? nextOrUpdater(prev)
          : nextOrUpdater;
      try {
        localStorage.setItem(
          WORKOUTS_STORAGE_KEY,
          serializeWorkoutsToStorage(next),
        );
      } catch {}
      return next;
    });
  }, []);

  const createWorkout = useCallback(() => {
    const w = {
      id: uid("w"),
      startedAt: new Date().toISOString(),
      endedAt: null,
      items: [],
      note: "",
    };
    persist((prev) => [w, ...prev]);
    return w;
  }, [persist]);

  /** Тренування з заданим часом початку (наприклад занесення заднім числом). */
  const createWorkoutWithTimes = useCallback(
    ({ startedAt }) => {
      const w = {
        id: uid("w"),
        startedAt: startedAt || new Date().toISOString(),
        endedAt: null,
        items: [],
        note: "",
      };
      persist((prev) => [w, ...prev]);
      return w;
    },
    [persist],
  );

  const endWorkout = useCallback(
    (id) => {
      const nowIso = new Date().toISOString();
      let ended = null;
      persist((prev) =>
        prev.map((w) => {
          if (w.id !== id) return w;
          if (w.endedAt) {
            ended = w;
            return w;
          }
          ended = { ...w, endedAt: nowIso };
          return ended;
        }),
      );
      return ended;
    },
    [persist],
  );

  const updateWorkout = useCallback(
    (id, patch) => {
      persist((prev) =>
        prev.map((w) => (w.id === id ? { ...w, ...patch } : w)),
      );
    },
    [persist],
  );

  const deleteWorkout = useCallback(
    (id) => {
      persist((prev) => prev.filter((w) => w.id !== id));
    },
    [persist],
  );

  const addItem = useCallback(
    (workoutId, item) => {
      persist((prev) =>
        prev.map((w) => {
          if (w.id !== workoutId) return w;
          return {
            ...w,
            items: [{ id: uid("i"), ...item }, ...(w.items || [])],
          };
        }),
      );
    },
    [persist],
  );

  const updateItem = useCallback(
    (workoutId, itemId, patch) => {
      persist((prev) =>
        prev.map((w) => {
          if (w.id !== workoutId) return w;
          return {
            ...w,
            items: (w.items || []).map((i) =>
              i.id === itemId ? { ...i, ...patch } : i,
            ),
          };
        }),
      );
    },
    [persist],
  );

  const removeItem = useCallback(
    (workoutId, itemId) => {
      persist((prev) =>
        prev.map((w) => {
          if (w.id !== workoutId) return w;
          return {
            ...w,
            items: (w.items || []).filter((i) => i.id !== itemId),
          };
        }),
      );
    },
    [persist],
  );

  const sorted = useMemo(() => {
    return [...workouts].sort((a, b) =>
      (b.startedAt || "").localeCompare(a.startedAt || ""),
    );
  }, [workouts]);

  return {
    workouts: sorted,
    createWorkout,
    createWorkoutWithTimes,
    updateWorkout,
    deleteWorkout,
    endWorkout,
    addItem,
    updateItem,
    removeItem,
  };
}
