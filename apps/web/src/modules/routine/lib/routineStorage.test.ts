// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { defaultRoutineState } from "@sergeant/routine-domain";

import { loadRoutineState, saveRoutineState } from "./routineStorage";
import {
  __setRoutineSqliteCompletionsCacheForTests,
  __setRoutineSqliteStateCacheForTests,
  clearSqliteCompletionsCache,
  clearSqliteRoutineStateCache,
} from "./sqliteReader";
import { safeWriteLS } from "@shared/lib/storage/storage";
import { DEMO_FLAG_KEY } from "../../../core/onboarding/seedDemoData/keys";

beforeEach(() => {
  // Stage 8 PR #057r-tombstone — load/persist now read from the
  // SQLite warm caches instead of localStorage, so each test starts
  // from a known-cold cache.
  clearSqliteCompletionsCache();
  clearSqliteRoutineStateCache();
  localStorage.clear();
});

describe("routine/routineStorage", () => {
  it("loadRoutineState returns default state when caches are cold", () => {
    const s = loadRoutineState();
    expect(s).toBeTruthy();
    expect(Array.isArray(s.habits)).toBe(true);
    expect(s.habits).toHaveLength(0);
    expect(Object.keys(s.completions)).toHaveLength(0);
  });

  it("loadRoutineState overlays the SQLite full-state cache once warm", () => {
    __setRoutineSqliteStateCacheForTests({
      habits: [
        {
          id: "h1",
          name: "Cached habit",
          archived: false,
          paused: false,
          recurrence: "daily",
          startDate: "2026-01-01",
          weekdays: [0, 1, 2, 3, 4, 5, 6],
          reminderTimes: [],
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      habitOrder: ["h1"],
    });
    __setRoutineSqliteCompletionsCacheForTests({
      completions: { h1: ["2026-01-02"] },
    });

    const s = loadRoutineState();
    expect(s.habits).toHaveLength(1);
    expect(s.habits[0]!.name).toBe("Cached habit");
    expect(s.completions).toEqual({ h1: ["2026-01-02"] });
    expect(s.habitOrder).toEqual(["h1"]);
  });

  it("falls back to the seeded LS blob in demo mode when caches are cold", () => {
    // Demo is anonymous → no SQLite boot → caches stay cold. The seeded
    // `hub_routine_v1` blob must surface instead of an empty board.
    safeWriteLS(DEMO_FLAG_KEY, "1");
    safeWriteLS("hub_routine_v1", {
      habits: [
        {
          id: "demo_h1",
          name: "Ранкова пробіжка",
          archived: false,
          paused: false,
          recurrence: "daily",
          startDate: "2026-06-01",
          weekdays: [0, 1, 2, 3, 4, 5, 6],
          reminderTimes: [],
          createdAt: "2026-06-01T00:00:00.000Z",
        },
      ],
      completions: { demo_h1: ["2026-06-20"] },
      habitOrder: ["demo_h1"],
    });

    const s = loadRoutineState();
    expect(s.habits.map((h) => h.id)).toEqual(["demo_h1"]);
    expect(s.completions).toEqual({ demo_h1: ["2026-06-20"] });
  });

  it("ignores the seeded LS blob when demo is NOT active", () => {
    safeWriteLS("hub_routine_v1", {
      habits: [{ id: "ls_only", name: "x", recurrence: "daily" }],
    });
    const s = loadRoutineState();
    expect(s.habits).toHaveLength(0);
  });

  it("saveRoutineState succeeds without touching localStorage", () => {
    const next = defaultRoutineState();
    expect(saveRoutineState(next)).toBe(true);
    // Tombstone confirmation: we never wrote to LS.
    expect(localStorage.getItem("hub_routine_v1")).toBe(null);
  });
});
