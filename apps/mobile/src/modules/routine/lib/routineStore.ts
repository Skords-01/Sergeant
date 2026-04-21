/**
 * MMKV-backed routine state hook for the mobile app.
 *
 * Mirrors the shape of `apps/web/src/modules/routine/lib/routineStorage.ts`
 * (Phase 5 / PR 2) but on top of MMKV via `@/lib/storage`. Delegates
 * all normalization / reducer logic to `@sergeant/routine-domain` so
 * mobile and web share the exact same `RoutineState` semantics.
 *
 * Scope of this file (Phase 5 / PR 2 — Calendar):
 *  - `loadRoutineState()` + `saveRoutineState()` — raw MMKV I/O with
 *    the shared `ROUTINE_STORAGE_KEY`.
 *  - `useRoutineStore()` — React hook that returns the current state
 *    plus action callbacks for the minimum set of mutations the
 *    Calendar screen needs (toggle completion, bulk-mark day,
 *    set completion note). Habits edit UI / reminders / backup /
 *    delete ship in later PRs.
 */

import { useCallback, useEffect, useState } from "react";
import {
  ROUTINE_STORAGE_KEY,
  applyMarkAllScheduledHabitsComplete,
  applySetCompletionNote,
  applyToggleHabitCompletion,
  defaultRoutineState,
  ensureHabitOrder,
  normalizeRoutineState,
  type RoutineState,
} from "@sergeant/routine-domain";
import { _getMMKVInstance, safeReadLS, safeWriteLS } from "@/lib/storage";

/** Читає й нормалізує повний стан Рутини з MMKV. */
export function loadRoutineState(): RoutineState {
  const raw = safeReadLS<unknown>(ROUTINE_STORAGE_KEY, null);
  const merged = normalizeRoutineState(raw);
  const { state, changed } = ensureHabitOrder(merged);
  if (changed) {
    safeWriteLS(ROUTINE_STORAGE_KEY, state);
  }
  return state;
}

/** Записує повний стан Рутини у MMKV. */
export function saveRoutineState(next: RoutineState): boolean {
  return safeWriteLS(ROUTINE_STORAGE_KEY, next);
}

export interface UseRoutineStoreReturn {
  routine: RoutineState;
  /** Примусово перечитати стан з MMKV (після зовнішнього запису). */
  refresh: () => void;
  /** Локально перезаписати весь стан (в обхід reducer-ів). */
  setRoutine: (next: RoutineState) => void;
  /** Тап по звичці у список дня — перемкнути відмітку на `dateKey`. */
  toggleHabit: (habitId: string, dateKey: string) => void;
  /** "Зробив усе" для дня — позначити кожну планову звичку виконаною. */
  bulkMarkDay: (dateKey: string) => void;
  /** Зберегти / стерти нотатку до відмітки. */
  setCompletionNote: (habitId: string, dateKey: string, text: string) => void;
}

/**
 * React-hook над MMKV: синхронний initial read, підписка на зовнішні
 * записи у той самий ключ через `addOnValueChangedListener`.
 */
export function useRoutineStore(): UseRoutineStoreReturn {
  const [routine, setRoutineState] = useState<RoutineState>(loadRoutineState);

  const refresh = useCallback(() => {
    setRoutineState(loadRoutineState());
  }, []);

  useEffect(() => {
    const mmkv = _getMMKVInstance();
    const sub = mmkv.addOnValueChangedListener((changedKey) => {
      if (changedKey === ROUTINE_STORAGE_KEY) refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const setRoutine = useCallback((next: RoutineState) => {
    setRoutineState(next);
    saveRoutineState(next);
  }, []);

  const toggleHabit = useCallback((habitId: string, dateKey: string) => {
    setRoutineState((prev) => {
      const next = applyToggleHabitCompletion(prev, habitId, dateKey);
      if (next === prev) return prev;
      saveRoutineState(next);
      return next;
    });
  }, []);

  const bulkMarkDay = useCallback((dateKey: string) => {
    setRoutineState((prev) => {
      const next = applyMarkAllScheduledHabitsComplete(prev, dateKey);
      if (next === prev) return prev;
      saveRoutineState(next);
      return next;
    });
  }, []);

  const setCompletionNote = useCallback(
    (habitId: string, dateKey: string, text: string) => {
      setRoutineState((prev) => {
        const next = applySetCompletionNote(prev, habitId, dateKey, text);
        if (next === prev) return prev;
        saveRoutineState(next);
        return next;
      });
    },
    [],
  );

  return {
    routine,
    refresh,
    setRoutine,
    toggleHabit,
    bulkMarkDay,
    setCompletionNote,
  };
}

// Re-export for consumers that want the canonical default without a
// second `@sergeant/routine-domain` import.
export { defaultRoutineState };
