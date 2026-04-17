import { describe, it, expect, vi } from "vitest";
import { loadRoutineState, saveRoutineState, ROUTINE_STORAGE_KEY } from "./routineStorage.js";

describe("routine/routineStorage", () => {
  it("loadRoutineState returns default when empty", () => {
    localStorage.removeItem(ROUTINE_STORAGE_KEY);
    const s = loadRoutineState();
    expect(s).toBeTruthy();
    expect(Array.isArray(s.habits)).toBe(true);
  });

  it("saveRoutineState returns false on storage failure", () => {
    const spy = vi.spyOn(globalThis.localStorage.__proto__, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    const ok = saveRoutineState(loadRoutineState());
    expect(ok).toBe(false);
    spy.mockRestore();
  });
});

