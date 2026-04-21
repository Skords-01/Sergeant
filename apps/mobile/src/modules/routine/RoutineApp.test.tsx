/**
 * Render tests for the Routine module shell (Phase 5 PR 1).
 *
 * Covers:
 *  - Default tab is "Календар" (web parity — web defaults to "calendar");
 *  - Tapping bottom-nav switches between the 3 placeholder screens;
 *  - Active tab is written to MMKV under STORAGE_KEYS.ROUTINE_MAIN_TAB
 *    (web parity — persisted tab survives the app lifecycle);
 *  - An existing persisted tab is picked up on first mount;
 *  - Legacy / malformed persisted value falls back to "calendar" without
 *    crashing the shell.
 */

import { fireEvent, render } from "@testing-library/react-native";

import { STORAGE_KEYS } from "@sergeant/shared";

import { _getMMKVInstance } from "@/lib/storage";

import { RoutineApp } from "./RoutineApp";

// Unique copy inside the mounted Calendar screen (the bottom-nav item
// label is just "Календар", so we pin to the eyebrow kicker inside
// `pages/Calendar.tsx` which only exists when that page is mounted).
const CALENDAR_EYEBROW = "Hub календар";
const STATS_DESCRIPTION =
  "Хітмеп виконання, стріки та топ-звички. Порт у наступних PR-ах Фази 5.";
const SETTINGS_DESCRIPTION =
  "Керування звичками, категоріями, тегами та нагадуваннями. Повний порт у наступних PR-ах Фази 5.";

beforeEach(() => {
  _getMMKVInstance().clearAll();
});

describe("RoutineApp shell", () => {
  it("renders the Calendar screen by default", () => {
    const { getByText } = render(<RoutineApp />);
    expect(getByText(CALENDAR_EYEBROW)).toBeTruthy();
  });

  it("switches to the Stats placeholder when the Stats tab is pressed", () => {
    const { getAllByText, getByText, queryByText } = render(<RoutineApp />);

    fireEvent.press(getAllByText("Статистика")[0]);

    expect(getByText(STATS_DESCRIPTION)).toBeTruthy();
    // Calendar screen body is no longer mounted.
    expect(queryByText(CALENDAR_EYEBROW)).toBeNull();
  });

  it("switches to the Settings placeholder when the Settings tab is pressed", () => {
    const { getAllByText, getByText } = render(<RoutineApp />);

    fireEvent.press(getAllByText("Налаштування")[0]);

    expect(getByText(SETTINGS_DESCRIPTION)).toBeTruthy();
  });

  it("writes the selected tab to MMKV under the shared ROUTINE_MAIN_TAB key", () => {
    const { getAllByText } = render(<RoutineApp />);

    fireEvent.press(getAllByText("Статистика")[0]);

    // We persist the tab as a raw string (web parity — web calls
    // localStorage.setItem(key, "stats") with no JSON wrapper).
    const raw = _getMMKVInstance().getString(STORAGE_KEYS.ROUTINE_MAIN_TAB);
    expect(raw).toBe("stats");
  });

  it("picks up a persisted tab from MMKV on first mount", () => {
    _getMMKVInstance().set(STORAGE_KEYS.ROUTINE_MAIN_TAB, "settings");

    const { getByText } = render(<RoutineApp />);

    expect(getByText(SETTINGS_DESCRIPTION)).toBeTruthy();
  });

  it("falls back to the Calendar tab when the persisted value is malformed", () => {
    _getMMKVInstance().set(STORAGE_KEYS.ROUTINE_MAIN_TAB, "not-a-valid-tab");

    const { getByText } = render(<RoutineApp />);

    expect(getByText(CALENDAR_EYEBROW)).toBeTruthy();
  });
});
