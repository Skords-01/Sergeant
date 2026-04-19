import { useEffect, useState } from "react";

/**
 * Shared read-only pointer to the in-progress Fizruk workout.
 *
 * Fizruk persists `fizruk_active_workout_id_v1` in localStorage while a
 * workout is open. Other surfaces (Hub header, module pages, cross-module
 * CTAs) need to see that signal so they can offer a "Повернутися до
 * тренування" shortcut without pulling in the whole `useWorkouts` API.
 *
 * Listens to `storage` events so that when the user ends a workout in
 * another tab the banner disappears immediately, not on next navigation.
 *
 * Also dispatches a synthetic `local-storage` event on same-tab writes
 * if callers want cross-component reactivity (Fizruk's own
 * setActiveWorkoutId dispatches via the effect that writes the key).
 */
const ACTIVE_WORKOUT_KEY = "fizruk_active_workout_id_v1";

function readId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_WORKOUT_KEY) || null;
  } catch {
    return null;
  }
}

export function useActiveFizrukWorkout(): string | null {
  const [id, setId] = useState<string | null>(() => readId());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      // e.key === null means storage was cleared entirely (logout, sync).
      if (e.key === ACTIVE_WORKOUT_KEY || e.key === null) {
        setId(readId());
      }
    };
    // Poll every 1.5s as a fallback — storage events don't fire in the
    // same tab, and Fizruk writes via localStorage.setItem in an effect.
    // The cost (1 localStorage.getItem per 1.5s) is negligible.
    const poll = setInterval(() => {
      const next = readId();
      setId((prev) => (prev === next ? prev : next));
    }, 1500);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      clearInterval(poll);
    };
  }, []);

  return id;
}
