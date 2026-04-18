import { useCallback, useEffect, useMemo, useState } from "react";
import {
  parseWorkoutsFromStorage,
  serializeWorkoutsToStorage,
  WORKOUTS_STORAGE_KEY,
} from "../lib/fizrukStorage";

/**
 * @typedef {{ id: string, done: boolean, label: string }} ChecklistItem
 */

/**
 * @typedef {{
 *   id: string,
 *   exerciseId: string,
 *   nameUk: string,
 *   primaryGroup: string,
 *   musclesPrimary: string[],
 *   musclesSecondary: string[],
 *   type: 'strength'|'distance'|'time',
 *   sets?: Array<{ weightKg: number, reps: number }>,
 *   durationSec?: number,
 *   distanceM?: number,
 * }} WorkoutItem
 * A single exercise entry within a workout session.
 */

/**
 * @typedef {{
 *   id: string,
 *   startedAt: string,
 *   endedAt: string|null,
 *   items: WorkoutItem[],
 *   groups: Array<{ id: string, itemIds: string[] }>,
 *   warmup: ChecklistItem[]|null,
 *   cooldown: ChecklistItem[]|null,
 *   note: string,
 * }} Workout
 * A complete workout session.
 */

/**
 * Generate a unique ID with a given prefix.
 * @param {string} [prefix]
 * @returns {string}
 */
function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const DEFAULT_WARMUP_ITEMS = [
  { label: "Загальна розминка (5-10 хв легкого кардіо)" },
  {
    label: "Суглобова розминка (шия, плечі, лікті, зап'ястки, стегна, коліна)",
  },
  { label: "Специфічна розминка до тренування (легкі підходи)" },
];

const DEFAULT_COOLDOWN_ITEMS = [
  { label: "Статична розтяжка опрацьованих м'язів (2-3 хв)" },
  { label: "Дихальні вправи / заспокоєння пульсу" },
  { label: "Пінний ролик або масаж (за потреби)" },
];

/**
 * Build a default warmup checklist with generated IDs.
 * @returns {ChecklistItem[]}
 */
export function makeDefaultWarmup() {
  return DEFAULT_WARMUP_ITEMS.map((x) => ({
    id: uid("wm"),
    ...x,
    done: false,
  }));
}

/**
 * Build a default cooldown checklist with generated IDs.
 * @returns {ChecklistItem[]}
 */
export function makeDefaultCooldown() {
  return DEFAULT_COOLDOWN_ITEMS.map((x) => ({
    id: uid("cd"),
    ...x,
    done: false,
  }));
}

/**
 * Hook for managing the list of workout sessions.
 * Persists to localStorage under `WORKOUTS_STORAGE_KEY`.
 *
 * @returns {{
 *   workouts: Workout[],
 *   loaded: boolean,
 *   createWorkout: () => Workout,
 *   createWorkoutWithTimes: (opts: { startedAt: string }) => Workout,
 *   updateWorkout: (id: string, patch: Partial<Workout>) => void,
 *   deleteWorkout: (id: string) => void,
 *   endWorkout: (id: string) => Workout|null,
 *   addItem: (workoutId: string, item: Partial<WorkoutItem>) => string,
 *   updateItem: (workoutId: string, itemId: string, patch: Partial<WorkoutItem>) => void,
 *   removeItem: (workoutId: string, itemId: string) => void,
 * }}
 */
export function useWorkouts() {
  const [workouts, setWorkouts] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(WORKOUTS_STORAGE_KEY);
      const parsed = parseWorkoutsFromStorage(raw);
      if (Array.isArray(parsed)) setWorkouts(parsed);
    } catch {}
    setLoaded(true);
  }, []);

  /**
   * Persist an updated workouts array to localStorage.
   * Accepts either a new array or an updater function.
   * @param {Workout[]|((prev: Workout[]) => Workout[])} nextOrUpdater
   */
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

  /**
   * Create a new workout session starting now and add it to the list.
   * @returns {Workout} The newly created workout.
   */
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

  /**
   * Create a new workout session with a custom start time.
   * @param {{ startedAt: string }} opts - ISO start timestamp.
   * @returns {Workout} The newly created workout.
   */
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

  /**
   * Mark a workout as ended with the current timestamp.
   * If the workout is already ended, returns it unchanged.
   * @param {string} id - Workout ID.
   * @returns {Workout|null} The updated (or already-ended) workout, or null.
   */
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

  /**
   * Apply a partial update to a workout.
   * @param {string} id - Workout ID.
   * @param {Partial<Workout>} patch - Fields to merge.
   */
  const updateWorkout = useCallback(
    (id, patch) => {
      persist((prev) =>
        prev.map((w) => (w.id === id ? { ...w, ...patch } : w)),
      );
    },
    [persist],
  );

  /**
   * Permanently delete a workout by ID.
   * @param {string} id - Workout ID.
   */
  const deleteWorkout = useCallback(
    (id) => {
      persist((prev) => prev.filter((w) => w.id !== id));
    },
    [persist],
  );

  /**
   * Add an exercise item to a workout. Appends to the items list so that the
   * stored order matches the order in which the user (or a template) added
   * exercises — users read the workout log top-to-bottom chronologically.
   * @param {string} workoutId
   * @param {Partial<WorkoutItem>} item - Item data; `id` is generated if absent.
   * @returns {string} The generated item ID.
   */
  const addItem = useCallback(
    (workoutId, item) => {
      const itemId = item.id || uid("i");
      persist((prev) =>
        prev.map((w) => {
          if (w.id !== workoutId) return w;
          return {
            ...w,
            items: [...(w.items || []), { id: itemId, ...item }],
          };
        }),
      );
      return itemId;
    },
    [persist],
  );

  /**
   * Apply a partial update to a specific exercise item within a workout.
   * @param {string} workoutId
   * @param {string} itemId
   * @param {Partial<WorkoutItem>} patch
   */
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

  /**
   * Remove an exercise item from a workout.
   * Also cleans up any superset groups that referenced the item.
   * @param {string} workoutId
   * @param {string} itemId
   */
  const removeItem = useCallback(
    (workoutId, itemId) => {
      persist((prev) =>
        prev.map((w) => {
          if (w.id !== workoutId) return w;
          const newGroups = (w.groups || [])
            .map((g) => ({
              ...g,
              itemIds: (g.itemIds || []).filter((id) => id !== itemId),
            }))
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

  /** Workouts sorted by `startedAt` descending (most recent first). */
  const sorted = useMemo(() => {
    return [...workouts].sort((a, b) =>
      (b.startedAt || "").localeCompare(a.startedAt || ""),
    );
  }, [workouts]);

  return {
    workouts: sorted,
    loaded,
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
