/**
 * Render tests for the Nutrition module shell (Phase 7 PR 4).
 *
 * Covers:
 *  - Default tab is "Сьогодні" (dashboard);
 *  - Tapping bottom-nav switches між Dashboard / Log / Water;
 *  - Selected tab is written до MMKV під ключем
 *    `STORAGE_KEYS.NUTRITION_MAIN_TAB` у raw-string форматі (web parity);
 *  - An existing persisted tab is picked up on first mount;
 *  - Legacy / malformed persisted value falls back to "dashboard".
 */

import { fireEvent, render } from "@testing-library/react-native";

import { STORAGE_KEYS } from "@sergeant/shared";

import { _getMMKVInstance } from "@/lib/storage";

import { NutritionApp } from "./NutritionApp";

// Унікальний рядок в Dashboard card ("Сьогодні").
const DASHBOARD_MARKER = "Сьогодні";
// Унікальний heading у Water сторінці.
const WATER_MARKER = "Щоденний трекер";
// Log: empty-state headline (немає записів при чистому MMKV).
const LOG_EMPTY_MARKER = "Немає записів за цей день";

beforeEach(() => {
  _getMMKVInstance().clearAll();
});

describe("NutritionApp shell", () => {
  it("renders the Dashboard screen by default", () => {
    const { getAllByText } = render(<NutritionApp />);
    // 1 — у Dashboard Card title, 1 — у bottom-nav label "Сьогодні".
    expect(getAllByText(DASHBOARD_MARKER).length).toBeGreaterThanOrEqual(1);
  });

  it("switches to the Log screen when the Journal tab is pressed", () => {
    const { getByTestId, getByText } = render(<NutritionApp />);

    fireEvent.press(getByTestId("nutrition-bottom-nav-log"));

    expect(getByText(LOG_EMPTY_MARKER)).toBeTruthy();
  });

  it("switches to the Water screen when the Water tab is pressed", () => {
    const { getByTestId, getByText } = render(<NutritionApp />);

    fireEvent.press(getByTestId("nutrition-bottom-nav-water"));

    expect(getByText(WATER_MARKER)).toBeTruthy();
  });

  it("writes the selected tab to MMKV under NUTRITION_MAIN_TAB", () => {
    const { getByTestId } = render(<NutritionApp />);

    fireEvent.press(getByTestId("nutrition-bottom-nav-log"));

    const raw = _getMMKVInstance().getString(STORAGE_KEYS.NUTRITION_MAIN_TAB);
    expect(raw).toBe("log");
  });

  it("picks up a persisted tab from MMKV on first mount", () => {
    _getMMKVInstance().set(STORAGE_KEYS.NUTRITION_MAIN_TAB, "water");

    const { getByText } = render(<NutritionApp />);

    expect(getByText(WATER_MARKER)).toBeTruthy();
  });

  it("falls back to dashboard when the persisted value is malformed", () => {
    _getMMKVInstance().set(STORAGE_KEYS.NUTRITION_MAIN_TAB, "garbage");

    const { getAllByText } = render(<NutritionApp />);

    expect(getAllByText(DASHBOARD_MARKER).length).toBeGreaterThanOrEqual(1);
  });
});
