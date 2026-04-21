/**
 * Render + interaction tests for `pages/Calendar.tsx` (Phase 5 / PR 2).
 *
 * Covers:
 *  - Порожній стан (без звичок) рендерить календар без краху;
 *  - Перемикач режимів видимий (Сьогодні / Тиждень / Місяць);
 *  - Звичку, запланована на сьогодні, видно у списку;
 *  - Тап по її рядку викликає `applyToggleHabitCompletion` через
 *    `useRoutineStore`, і стан зберігається у MMKV.
 */

import { fireEvent, render } from "@testing-library/react-native";

import {
  dateKeyFromDate,
  defaultRoutineState,
  ROUTINE_STORAGE_KEY,
  serializeRoutineState,
  todayDate,
  type Habit,
} from "@sergeant/routine-domain";

import { _getMMKVInstance } from "@/lib/storage";

import { Calendar } from "./Calendar";

beforeEach(() => {
  _getMMKVInstance().clearAll();
});

function seedHabit(habit: Partial<Habit> = {}): void {
  const base = defaultRoutineState();
  const seeded: Habit = {
    id: "h1",
    name: "Випити воду",
    emoji: "💧",
    recurrence: "daily",
    tagIds: [],
    categoryId: null,
    archived: false,
    reminderTimes: [],
    ...habit,
  } as Habit;
  const state = {
    ...base,
    habits: [seeded],
    habitOrder: [seeded.id],
    prefs: {
      ...base.prefs,
      showFizrukInCalendar: false,
      showFinykSubscriptionsInCalendar: false,
    },
  };
  _getMMKVInstance().set(ROUTINE_STORAGE_KEY, serializeRoutineState(state));
}

describe("Calendar (mobile)", () => {
  it("renders without crashing when there are no habits", () => {
    const { getByText } = render(<Calendar />);
    expect(getByText("Hub календар")).toBeTruthy();
    expect(getByText("Сьогодні")).toBeTruthy();
  });

  it("shows time-mode segmented control", () => {
    const { getAllByText } = render(<Calendar />);
    // "Сьогодні" used twice: mode button + "go-to-today" action when in
    // month view — in initial "today" mode there is only the segmented
    // entry, so this is still assertable via the label.
    expect(getAllByText("Сьогодні").length).toBeGreaterThan(0);
    expect(getAllByText("Тиждень").length).toBeGreaterThan(0);
    expect(getAllByText("Місяць").length).toBeGreaterThan(0);
  });

  it("renders a seeded daily habit in today's list", () => {
    seedHabit();
    const { getByText } = render(<Calendar />);
    expect(getByText("💧 Випити воду")).toBeTruthy();
  });

  it("toggles habit completion and persists to MMKV", () => {
    seedHabit();
    const todayKey = dateKeyFromDate(todayDate());
    const { getByText } = render(<Calendar />);

    fireEvent.press(getByText("💧 Випити воду"));

    const raw = _getMMKVInstance().getString(ROUTINE_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw || "{}");
    expect(parsed.completions?.h1 ?? []).toContain(todayKey);
  });
});
