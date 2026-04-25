import { describe, it, expect, vi } from "vitest";
import {
  loadRoutineState,
  saveRoutineState,
  ROUTINE_STORAGE_KEY,
} from "./routineStorage";

if (!globalThis.localStorage) {
  let store: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  } as Storage;
}

describe("routine/routineStorage", () => {
  it("loadRoutineState returns default when empty", () => {
    localStorage.removeItem(ROUTINE_STORAGE_KEY);
    const s = loadRoutineState();
    expect(s).toBeTruthy();
    expect(Array.isArray(s.habits)).toBe(true);
  });

  it("saveRoutineState returns false on storage failure", () => {
    const spy = vi
      .spyOn(globalThis.localStorage, "setItem")
      .mockImplementation(() => {
        throw new Error("quota");
      });
    const ok = saveRoutineState(loadRoutineState());
    expect(ok).toBe(false);
    spy.mockRestore();
  });
});
