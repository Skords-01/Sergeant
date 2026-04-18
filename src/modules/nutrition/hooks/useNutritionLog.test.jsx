// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useNutritionLog } from "./useNutritionLog.js";
import { NUTRITION_LOG_KEY } from "../lib/nutritionStorage.js";

describe("useNutritionLog – defensive imports", () => {
  let errorSpy;

  beforeEach(() => {
    localStorage.clear();
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it("replaceLogFromJsonText returns false and does not throw on malformed JSON", () => {
    const { result } = renderHook(() => useNutritionLog());
    let ok;
    act(() => {
      ok = result.current.replaceLogFromJsonText("{not: valid json");
    });
    expect(ok).toBe(false);
    expect(errorSpy).toHaveBeenCalled();
    // previous state preserved (empty log)
    expect(result.current.nutritionLog).toEqual({});
  });

  it("mergeLogFromJsonText returns false on malformed JSON and preserves existing log", async () => {
    const seeded = {
      "2025-01-01": {
        meals: [
          {
            id: "m1",
            name: "Toast",
            time: "09:00",
            mealType: "breakfast",
            label: "",
            macros: { kcal: 100, protein_g: 5, fat_g: 2, carbs_g: 15 },
            source: "manual",
            macroSource: "manual",
            amount_g: null,
            foodId: null,
          },
        ],
      },
    };
    localStorage.setItem(NUTRITION_LOG_KEY, JSON.stringify(seeded));

    const { result } = renderHook(() => useNutritionLog());
    await waitFor(() =>
      expect(result.current.nutritionLog["2025-01-01"]?.meals?.length).toBe(1),
    );

    let ok;
    act(() => {
      ok = result.current.mergeLogFromJsonText("not json at all");
    });
    expect(ok).toBe(false);
    expect(errorSpy).toHaveBeenCalled();
    expect(result.current.nutritionLog["2025-01-01"].meals).toHaveLength(1);
  });

  it("replaceLogFromJsonText returns true on valid JSON and applies normalized log", async () => {
    const { result } = renderHook(() => useNutritionLog());
    const payload = {
      "2025-02-03": {
        meals: [
          {
            id: "x",
            name: "Apple",
            time: "10:00",
            mealType: "snack",
            label: "",
            macros: { kcal: 50, protein_g: 0, fat_g: 0, carbs_g: 12 },
            source: "manual",
            macroSource: "manual",
          },
        ],
      },
    };
    let ok;
    act(() => {
      ok = result.current.replaceLogFromJsonText(JSON.stringify(payload));
    });
    expect(ok).toBe(true);
    await waitFor(() =>
      expect(result.current.nutritionLog["2025-02-03"]?.meals?.length).toBe(1),
    );
  });

  it("replaceLogFromJsonText ignores non-object JSON (array / null) without throwing", () => {
    const { result } = renderHook(() => useNutritionLog());
    let ok1;
    act(() => {
      ok1 = result.current.replaceLogFromJsonText("null");
    });
    expect(ok1).toBe(true);
    expect(result.current.nutritionLog).toEqual({});

    let ok2;
    act(() => {
      ok2 = result.current.replaceLogFromJsonText("[1,2,3]");
    });
    expect(ok2).toBe(true);
    expect(result.current.nutritionLog).toEqual({});
  });
});
