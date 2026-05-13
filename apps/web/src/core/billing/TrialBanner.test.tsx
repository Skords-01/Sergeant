/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import type { UsePlanResult } from "./usePlan";

const { usePlanMock } = vi.hoisted(() => ({
  usePlanMock: vi.fn<() => UsePlanResult>(),
}));

vi.mock("./usePlan", () => ({
  usePlan: () => usePlanMock(),
}));

import { TrialBanner } from "./TrialBanner";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-05-13T12:00:00.000Z");
const STORAGE_KEY = "sergeant.billing.trialBannerDismissed.v1";

function trialingPlan(currentPeriodEnd: string | null): UsePlanResult {
  return {
    plan: "pro",
    isPro: true,
    isLoading: false,
    subscription: {
      id: 42,
      provider: "stripe",
      plan: "pro",
      status: "trialing",
      active: true,
      currentPeriodEnd,
    },
  };
}

function activePlan(): UsePlanResult {
  return {
    plan: "pro",
    isPro: true,
    isLoading: false,
    subscription: {
      id: 42,
      provider: "stripe",
      plan: "pro",
      status: "active",
      active: true,
      currentPeriodEnd: new Date(NOW.getTime() + 30 * DAY_MS).toISOString(),
    },
  };
}

function freePlan(): UsePlanResult {
  return {
    plan: "free",
    isPro: false,
    isLoading: false,
    subscription: null,
  };
}

function NavSpy({ onChange }: { onChange: (path: string) => void }) {
  const location = useLocation();
  onChange(`${location.pathname}${location.search}`);
  return null;
}

function renderBanner(now: Date, navSpy: (path: string) => void = () => {}) {
  return render(
    <MemoryRouter initialEntries={["/finyk"]}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <NavSpy onChange={navSpy} />
              <TrialBanner now={now} />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("TrialBanner (audit P1-9 — initiative 0010 Phase 4.2)", () => {
  beforeEach(() => {
    usePlanMock.mockReset();
    localStorage.clear();
  });
  afterEach(() => {
    cleanup();
  });

  it("does NOT render when the subscription is not trialing (active / free)", () => {
    usePlanMock.mockReturnValue(activePlan());
    const { rerender } = renderBanner(NOW);
    expect(screen.queryByTestId("trial-banner")).toBeNull();

    usePlanMock.mockReturnValue(freePlan());
    rerender(
      <MemoryRouter>
        <TrialBanner now={NOW} />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId("trial-banner")).toBeNull();
  });

  it("does NOT render when trialEndsAt is more than 3 days away", () => {
    const trialEnd = new Date(NOW.getTime() + 5 * DAY_MS).toISOString();
    usePlanMock.mockReturnValue(trialingPlan(trialEnd));
    renderBanner(NOW);
    expect(screen.queryByTestId("trial-banner")).toBeNull();
  });

  it("renders the UA copy + CTA when trialEndsAt is within the 3-day window", () => {
    const trialEnd = new Date(
      NOW.getTime() + 2.5 * DAY_MS, // 3 days remaining after Math.ceil
    ).toISOString();
    usePlanMock.mockReturnValue(trialingPlan(trialEnd));
    renderBanner(NOW);

    expect(screen.getByTestId("trial-banner")).toBeTruthy();
    expect(
      screen.getByText(/До завершення пробного періоду залишилось 3 дні\./),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Оформити підписку/ }),
    ).toBeTruthy();
  });

  it("navigates to /pricing when the primary CTA is pressed", () => {
    const trialEnd = new Date(
      NOW.getTime() + 12 * 60 * 60 * 1000,
    ).toISOString();
    usePlanMock.mockReturnValue(trialingPlan(trialEnd));

    let lastPath = "";
    renderBanner(NOW, (p) => {
      lastPath = p;
    });

    // 1 day remaining → singular UA form
    expect(
      screen.getByText(/До завершення пробного періоду залишилось 1 день\./),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Оформити підписку/ }));
    expect(lastPath).toBe("/pricing");
  });

  it("hides the banner after the user dismisses it and persists per-period", () => {
    const trialEnd = new Date(NOW.getTime() + 2 * DAY_MS).toISOString();
    usePlanMock.mockReturnValue(trialingPlan(trialEnd));

    const { rerender, unmount } = renderBanner(NOW);
    expect(screen.getByTestId("trial-banner")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: /Закрити банер пробного періоду/ }),
    );
    expect(screen.queryByTestId("trial-banner")).toBeNull();
    // `safeWriteLS` short-circuits strings — value is the raw ISO, not
    // a JSON-encoded "…ISO…".
    expect(localStorage.getItem(STORAGE_KEY)).toBe(trialEnd);

    // Re-render with the same trial-end ISO — banner stays dismissed.
    rerender(
      <MemoryRouter>
        <TrialBanner now={NOW} />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId("trial-banner")).toBeNull();
    unmount();

    // A renewed subscription pushes a new currentPeriodEnd — the dismiss
    // flag no longer matches and the banner re-arms.
    const renewedEnd = new Date(NOW.getTime() + 1.5 * DAY_MS).toISOString();
    usePlanMock.mockReturnValue(trialingPlan(renewedEnd));
    renderBanner(NOW);
    expect(screen.getByTestId("trial-banner")).toBeTruthy();
  });
});
