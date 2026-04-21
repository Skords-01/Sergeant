/**
 * Smoke test for the Finyk mobile module shell.
 *
 * After Phase 4 / "Overview page" PR, `FinykApp` is a thin wrapper that
 * renders the full Overview screen. We assert on a few stable Overview
 * surfaces (hero + planning copy, nav buttons) so this test is a
 * regression fence for the composition itself, not for individual card
 * internals (those have their own tests).
 */
import { render, screen } from "@testing-library/react-native";

import { FinykApp } from "./FinykApp";

jest.mock("expo-router", () => ({
  __esModule: true,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

describe("FinykApp shell", () => {
  it("renders the Overview hero card", () => {
    render(<FinykApp />);
    expect(screen.getByTestId("finyk-overview-hero")).toBeTruthy();
    expect(screen.getByText("Загальний нетворс")).toBeTruthy();
  });

  it("renders the in-module navigation buttons", () => {
    render(<FinykApp />);
    expect(screen.getByText("Операції →")).toBeTruthy();
    expect(screen.getByText("Бюджети →")).toBeTruthy();
  });

  it("renders the networth empty-state on first-run data", () => {
    render(<FinykApp />);
    // Networth history starts empty in the `useFinykOverviewData` stub
    // — we expect the "too few snapshots" placeholder, not the chart.
    expect(screen.getByTestId("finyk-overview-networth-empty")).toBeTruthy();
  });
});
