/**
 * Jest render + behaviour tests for the Fizruk Workouts page (Phase 6).
 *
 * Coverage:
 *  - Empty state renders when there is no active workout and no journal.
 *  - Pressing "Почати тренування" starts an active workout and shows
 *    the elapsed timer widget.
 *  - Switching to the journal tab renders one row per persisted workout.
 *  - Tapping a catalogue exercise adds it to the active workout.
 *  - Opening the set editor, filling in weight+reps and saving appends
 *    a set to the active item and persists it to MMKV.
 *
 * All persistence flows through the real `useFizrukWorkouts` /
 * `useActiveFizrukWorkout` hooks, so the in-memory MMKV shim
 * registered in `jest.setup.js` exercises the hook-reducer-storage
 * contract end-to-end.
 */

import { AccessibilityInfo } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { STORAGE_KEYS } from "@sergeant/shared";

import { _getMMKVInstance, safeWriteLS } from "@/lib/storage";

import { Workouts } from "./Workouts";

jest.mock("react-native-safe-area-context", () => {
  const RN = jest.requireActual("react-native");
  return {
    SafeAreaView: RN.View,
    SafeAreaProvider: ({ children }: { children: unknown }) => children,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

beforeEach(() => {
  _getMMKVInstance().clearAll();
  jest
    .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
    .mockResolvedValue(false);
  jest
    .spyOn(AccessibilityInfo, "addEventListener")
    .mockImplementation(() => ({ remove: () => {} }) as never);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("Fizruk Workouts page (mobile)", () => {
  it("renders the no-active-workout empty state by default", () => {
    render(<Workouts />);

    expect(screen.getByText("Тренування")).toBeTruthy();
    expect(screen.getByTestId("fizruk-workouts-active")).toBeTruthy();
    expect(screen.getByTestId("fizruk-workouts-active-start")).toBeTruthy();
    // Segmented tabs visible.
    expect(screen.getByTestId("fizruk-workouts-mode-catalog")).toBeTruthy();
    expect(screen.getByTestId("fizruk-workouts-mode-log")).toBeTruthy();
  });

  it("starts a new workout when the primary CTA is pressed", () => {
    render(<Workouts />);

    fireEvent.press(screen.getByTestId("fizruk-workouts-active-start"));

    // Elapsed timer takes over the panel.
    expect(screen.getByTestId("fizruk-workouts-active-elapsed")).toBeTruthy();
    expect(screen.getByTestId("fizruk-workouts-active-finish")).toBeTruthy();

    const rawActive = _getMMKVInstance().getString(
      STORAGE_KEYS.FIZRUK_ACTIVE_WORKOUT,
    );
    expect(rawActive).toBeTruthy();
    const rawWorkouts = _getMMKVInstance().getString(
      STORAGE_KEYS.FIZRUK_WORKOUTS,
    );
    expect(rawWorkouts).toBeTruthy();
    const parsed = JSON.parse(rawWorkouts ?? "[]") as Array<{ id: string }>;
    expect(parsed).toHaveLength(1);
  });

  it("renders journal rows when switched to the log tab", () => {
    safeWriteLS(STORAGE_KEYS.FIZRUK_WORKOUTS, [
      {
        id: "w_older",
        startedAt: "2026-04-10T12:00:00Z",
        endedAt: "2026-04-10T13:00:00Z",
        items: [],
        groups: [],
        warmup: null,
        cooldown: null,
        note: "",
      },
      {
        id: "w_newer",
        startedAt: "2026-04-20T18:00:00Z",
        endedAt: "2026-04-20T19:00:00Z",
        items: [],
        groups: [],
        warmup: null,
        cooldown: null,
        note: "",
      },
    ]);

    render(<Workouts />);

    fireEvent.press(screen.getByTestId("fizruk-workouts-mode-log"));

    expect(
      screen.getByTestId("fizruk-workouts-journal-row-w_older"),
    ).toBeTruthy();
    expect(
      screen.getByTestId("fizruk-workouts-journal-row-w_newer"),
    ).toBeTruthy();
  });

  it("adds the tapped catalogue exercise to the active workout", () => {
    render(<Workouts />);

    // Start a workout so tapping the catalogue doesn't bootstrap one.
    fireEvent.press(screen.getByTestId("fizruk-workouts-active-start"));

    // Filter down to a single exercise via the search field so the
    // test doesn't depend on the bundled catalog's ordering.
    fireEvent.changeText(
      screen.getByTestId("fizruk-workouts-catalog-search"),
      "Жим штанги лежачи",
    );

    const rawBefore = _getMMKVInstance().getString(
      STORAGE_KEYS.FIZRUK_WORKOUTS,
    );
    const parsedBefore = JSON.parse(rawBefore ?? "[]") as Array<{
      items: { id: string }[];
    }>;
    expect(parsedBefore[0]?.items).toHaveLength(0);

    const rows = screen.getAllByTestId(/^fizruk-workouts-catalog-row-/);
    expect(rows.length).toBeGreaterThan(0);

    act(() => {
      fireEvent.press(rows[0]!);
    });

    const rawAfter = _getMMKVInstance().getString(STORAGE_KEYS.FIZRUK_WORKOUTS);
    const parsedAfter = JSON.parse(rawAfter ?? "[]") as Array<{
      items: { id: string; exerciseId?: string }[];
    }>;
    expect(parsedAfter[0]?.items ?? []).toHaveLength(1);
  });

  it("appends a set via the active-set editor", () => {
    render(<Workouts />);

    fireEvent.press(screen.getByTestId("fizruk-workouts-active-start"));

    fireEvent.changeText(
      screen.getByTestId("fizruk-workouts-catalog-search"),
      "Жим штанги лежачи",
    );

    const rows = screen.getAllByTestId(/^fizruk-workouts-catalog-row-/);
    act(() => {
      fireEvent.press(rows[0]!);
    });

    // Find the first active-item card and its "+ Додати сет" button.
    const addSetButtons = screen.getAllByTestId(/-add-set$/);
    expect(addSetButtons.length).toBeGreaterThan(0);
    act(() => {
      fireEvent.press(addSetButtons[0]!);
    });

    // Fill the weight + reps and save.
    fireEvent.changeText(
      screen.getByTestId("fizruk-workouts-set-editor-weight-input"),
      "60",
    );
    fireEvent.changeText(
      screen.getByTestId("fizruk-workouts-set-editor-reps-input"),
      "10",
    );

    act(() => {
      fireEvent.press(screen.getByTestId("fizruk-workouts-set-editor-save"));
    });

    const rawAfter = _getMMKVInstance().getString(STORAGE_KEYS.FIZRUK_WORKOUTS);
    const parsed = JSON.parse(rawAfter ?? "[]") as Array<{
      items: {
        sets?: { weightKg: number; reps: number }[];
      }[];
    }>;
    const sets = parsed[0]?.items[0]?.sets ?? [];
    expect(sets).toHaveLength(1);
    expect(sets[0]).toMatchObject({ weightKg: 60, reps: 10 });
  });
});
