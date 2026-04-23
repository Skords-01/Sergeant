/**
 * Jest render + behaviour tests for the Fizruk Workouts page.
 *
 * Coverage:
 *  - Home view renders the active-workout hero, catalog quick-link,
 *    and the empty recent-workouts placeholder.
 *  - Pressing "Почати тренування" starts an active workout and routes
 *    to the catalog subview (elapsed timer visible in the hero).
 *  - Tapping "Всі →" from home opens the full journal subview.
 *  - Tapping a catalogue exercise adds it to the active workout.
 *  - Opening the set editor, filling in weight+reps and saving appends
 *    a set to the active item and persists it to MMKV.
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
  it("renders the home view with start CTA and catalog tile by default", () => {
    render(<Workouts />);

    expect(screen.getByText("Тренування")).toBeTruthy();
    expect(screen.getByTestId("fizruk-workouts-active")).toBeTruthy();
    expect(screen.getByTestId("fizruk-workouts-active-start")).toBeTruthy();
    expect(screen.getByTestId("fizruk-workouts-open-catalog")).toBeTruthy();
    // Recent-workouts empty-state hint is visible on first load.
    expect(screen.getByTestId("fizruk-workouts-recent")).toBeTruthy();
  });

  it("starts a new workout when the primary CTA is pressed and jumps to the catalog", () => {
    render(<Workouts />);

    fireEvent.press(screen.getByTestId("fizruk-workouts-active-start"));

    // Elapsed timer takes over the panel.
    expect(screen.getByTestId("fizruk-workouts-active-elapsed")).toBeTruthy();
    expect(screen.getByTestId("fizruk-workouts-active-finish")).toBeTruthy();
    // The catalog subview is now active (search input visible).
    expect(screen.getByTestId("fizruk-workouts-catalog-search")).toBeTruthy();

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

  it("opens the journal subview from the 'Всі →' shortcut", () => {
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

    fireEvent.press(screen.getByTestId("fizruk-workouts-open-journal"));

    expect(
      screen.getByTestId("fizruk-workouts-journal-row-w_older"),
    ).toBeTruthy();
    expect(
      screen.getByTestId("fizruk-workouts-journal-row-w_newer"),
    ).toBeTruthy();
  });

  it("adds the tapped catalogue exercise to the active workout", () => {
    render(<Workouts />);

    fireEvent.press(screen.getByTestId("fizruk-workouts-active-start"));

    // Home → catalog jump happens automatically via handleStart.
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

    // Navigate back to home to access the active-item cards (they
    // live alongside the hero, not inside the catalog subview).
    fireEvent.press(screen.getByTestId("fizruk-workouts-back"));

    const addSetButtons = screen.getAllByTestId(/-add-set$/);
    expect(addSetButtons.length).toBeGreaterThan(0);
    act(() => {
      fireEvent.press(addSetButtons[0]!);
    });

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
