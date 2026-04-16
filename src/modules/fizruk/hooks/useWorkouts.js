import { useCallback, useEffect, useMemo, useState } from "react";
import {
  parseWorkoutsFromStorage,
  serializeWorkoutsToStorage,
  WORKOUTS_STORAGE_KEY,
} from "../lib/fizrukStorage";

function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const DEFAULT_WARMUP_ITEMS = [
  { label: "Загальна розминка (5-10 хв легкого кардіо)" },
  { label: "Суглобова розминка (шия, плечі, лікті, зап'ястки, стегна, коліна)" },
  { label: "Специфічна розминка до тренування (легкі підходи)" },
];

const DEFAULT_COOLDOWN_ITEMS = [
  { label: "Статична розтяжка опрацьованих м'язів (2-3 хв)" },
  { label: "Дихальні вправи / заспокоєння пульсу" },
  { label: "Пінний ролик або масаж (за потреби)" },
];

export function makeDefaultWarmup() {
  return DEFAULT_WARMUP_ITEMS.map((x) => ({ id: uid("wm"), ...x, done: false }));
}

export function makeDefaultCooldown() {
  return DEFAULT_COOLDOWN_ITEMS.map((x) => ({ id: uid("cd"), ...x, done: false }));
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
      groups: [],
      warmup: null,
      cooldown: null,
      note: "",
    };
    persist((prev) => [w, ...prev]);
    return w;
  }, [persist]);

  const createWorkoutWithTimes = useCallback(
    ({ startedAt }) => {
      const w = {
        id: uid("w"),
        startedAt: startedAt || new Date().toISOString(),
        endedAt: null,
        items: [],
        groups: [],
        warmup: null,
        cooldown: null,
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
      const itemId = item.id || uid("i");
      persist((prev) =>
        prev.map((w) => {
          if (w.id !== workoutId) return w;
          return {
            ...w,
            items: [{ id: itemId, ...item }, ...(w.items || [])],
          };
        }),
      );
      return itemId;
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
          const newGroups = (w.groups || [])
            .map((g) => ({ ...g, itemIds: (g.itemIds || []).filter((id) => id !== itemId) }))
            .filter((g) => (g.itemIds || []).length >= 2);
          return {
            ...w,
            items: (w.items || []).filter((i) => i.id !== itemId),
            groups: newGroups,
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
