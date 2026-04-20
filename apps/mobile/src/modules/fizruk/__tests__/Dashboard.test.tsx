/**
 * Render tests for the Fizruk Dashboard (Phase 6 / PR-1).
 *
 * The Dashboard is the stack-root of the nested Fizruk router. These
 * tests assert the two invariants that matter for the shell PR:
 *
 *   1. Every non-dashboard `FizrukPage` has exactly one navigation
 *      card (no missing entries, no duplicates).
 *   2. Tapping the primary CTA routes to `/fizruk/workouts`, and
 *      tapping any nav card routes to the corresponding segment.
 */

import { fireEvent, render } from "@testing-library/react-native";

import { Dashboard, fizrukNavCardCoverage } from "../pages/Dashboard";
import { FIZRUK_PAGES } from "../shell/fizrukRoute";

jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
}));

// SafeAreaContext needs provider/mock in RN test env.
jest.mock("react-native-safe-area-context", () => {
  const RN = jest.requireActual("react-native");
  return {
    SafeAreaView: RN.View,
    SafeAreaProvider: ({ children }: { children: unknown }) => children,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

import { router } from "expo-router";

describe("Fizruk Dashboard", () => {
  beforeEach(() => {
    (router.push as jest.Mock).mockClear();
  });

  it("covers every non-dashboard Fizruk page with exactly one nav card", () => {
    const coverage = fizrukNavCardCoverage();
    expect(coverage.missing).toEqual([]);
    expect(coverage.extras).toEqual([]);
    // Sanity: the curated list in FIZRUK_PAGES is non-empty.
    expect(FIZRUK_PAGES.length).toBeGreaterThan(1);
  });

  it("routes the primary CTA to /fizruk/workouts", () => {
    const { getByLabelText } = render(<Dashboard />);
    fireEvent.press(getByLabelText("Перейти до тренувань"));
    expect(router.push).toHaveBeenCalledWith("/fizruk/workouts");
  });

  it("routes a nav-card press to the matching segment", () => {
    const { getByLabelText } = render(<Dashboard />);
    fireEvent.press(getByLabelText("План"));
    expect(router.push).toHaveBeenCalledWith("/fizruk/plan");
    fireEvent.press(getByLabelText("Атлас"));
    expect(router.push).toHaveBeenCalledWith("/fizruk/atlas");
  });
});
