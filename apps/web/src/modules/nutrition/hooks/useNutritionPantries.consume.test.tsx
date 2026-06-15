// @vitest-environment jsdom
//
// audit-08 F15 — consumePantryItem UOM / density conversion.
//
// `consumePantryItem(name, gramsConsumed)` always receives grams eaten (the
// AddMeal sheet passes a gram amount). This suite pins the conversion into the
// item's stored unit — г / кг / мл / л / шт — plus the "leave untouched" path
// for units with no fixed gram equivalence (уп) and missing/zero stock.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("@shared/api", async () => {
  const actual =
    await vi.importActual<typeof import("@shared/api")>("@shared/api");
  return {
    ...actual,
    nutritionApi: { parsePantry: vi.fn() },
  };
});

import { useNutritionPantries } from "./useNutritionPantries";
import { type Pantry } from "../lib/nutritionStorage";
import { type PantryItem } from "../lib/pantryTextParser";
import {
  __setNutritionSqliteCacheForTests,
  clearNutritionSqliteCache,
} from "../lib/sqliteReader";
import { notifyNutritionSqliteCacheRefresh } from "../lib/sqliteReadGate";

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

function seedPantries(pantries: Pantry[], activeId: string) {
  __setNutritionSqliteCacheForTests({
    pantries,
    activePantryId: String(activeId),
  });
  notifyNutritionSqliteCacheRefresh();
}

function renderHarness() {
  const setBusy = vi.fn();
  const setErr = vi.fn();
  const setStatusText = vi.fn();
  const { result } = renderHook(
    () => useNutritionPantries({ setBusy, setErr, setStatusText }),
    { wrapper: makeWrapper() },
  );
  return { result };
}

function pantryWith(item: PantryItem): Pantry {
  return { id: "home", name: "Дім", items: [item], text: "" };
}

async function consumeAndRead(
  item: PantryItem,
  name: string,
  grams: number,
): Promise<PantryItem | undefined> {
  seedPantries([pantryWith(item)], "home");
  const { result } = renderHarness();
  await waitFor(() => expect(result.current.pantryItems.length).toBe(1));
  act(() => {
    result.current.consumePantryItem(name, grams);
  });
  await waitFor(() => {
    // re-read from the active pantry each tick
    expect(result.current.pantries.length).toBeGreaterThan(0);
  });
  return result.current.pantries[0]?.items?.[0];
}

describe("useNutritionPantries — consumePantryItem UOM conversion", () => {
  beforeEach(() => {
    localStorage.clear();
    clearNutritionSqliteCache();
    vi.clearAllMocks();
  });

  it("г: subtracts grams 1:1", async () => {
    const out = await consumeAndRead(
      { name: "рис", qty: 500, unit: "г", notes: null },
      "рис",
      120,
    );
    expect(out?.qty).toBe(380);
  });

  it("кг: subtracts grams/1000", async () => {
    const out = await consumeAndRead(
      { name: "рис", qty: 2, unit: "кг", notes: null },
      "рис",
      500,
    );
    expect(out?.qty).toBe(1.5);
  });

  it("мл: converts grams via density (молоко 1.03 g/ml)", async () => {
    // 206 g / 1.03 = 200 ml → 1000 - 200 = 800 ml
    const out = await consumeAndRead(
      { name: "молоко", qty: 1000, unit: "мл", notes: null },
      "молоко",
      206,
    );
    expect(out?.qty).toBe(800);
  });

  it("л: converts grams via density then /1000 (default 1.0 g/ml)", async () => {
    // вода: 300 g / 1.0 / 1000 = 0.3 л → 2 - 0.3 = 1.7 л.
    // (qty is rounded to 1 decimal — see Math.round(remaining*10)/10.)
    const out = await consumeAndRead(
      { name: "вода", qty: 2, unit: "л", notes: null },
      "вода",
      300,
    );
    expect(out?.qty).toBe(1.7);
  });

  it("шт: converts grams via per-piece weight (яйце 60 g)", async () => {
    // 180 g / 60 = 3 шт → 10 - 3 = 7 шт
    const out = await consumeAndRead(
      { name: "яйце", qty: 10, unit: "шт", notes: null },
      "яйце",
      180,
    );
    expect(out?.qty).toBe(7);
  });

  it("шт: unknown food falls back to 100 g/piece default", async () => {
    // 200 g / 100 = 2 шт → 5 - 2 = 3 шт
    const out = await consumeAndRead(
      { name: "булочка", qty: 5, unit: "шт", notes: null },
      "булочка",
      200,
    );
    expect(out?.qty).toBe(3);
  });

  it("undefined/null unit: treated as grams", async () => {
    const out = await consumeAndRead(
      { name: "борошно", qty: 500, unit: null, notes: null },
      "борошно",
      150,
    );
    expect(out?.qty).toBe(350);
  });

  it("уп (no gram equivalence): item left untouched", async () => {
    const out = await consumeAndRead(
      { name: "печиво", qty: 2, unit: "уп", notes: null },
      "печиво",
      200,
    );
    expect(out?.qty).toBe(2);
    expect(out?.unit).toBe("уп");
  });

  it("removes the item when consumption drains it to <= 0", async () => {
    seedPantries(
      [pantryWith({ name: "рис", qty: 100, unit: "г", notes: null })],
      "home",
    );
    const { result } = renderHarness();
    await waitFor(() => expect(result.current.pantryItems.length).toBe(1));
    act(() => {
      result.current.consumePantryItem("рис", 150);
    });
    await waitFor(() => {
      expect(result.current.pantries[0]?.items?.length).toBe(0);
    });
  });

  it("no-op when stock qty is missing", async () => {
    const out = await consumeAndRead(
      { name: "сіль", qty: null, unit: "г", notes: null },
      "сіль",
      50,
    );
    expect(out?.qty).toBe(null);
  });
});
