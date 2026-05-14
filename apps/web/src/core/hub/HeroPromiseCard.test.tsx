// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { HeroPromiseCard } from "./HeroPromiseCard";
import { ANALYTICS_EVENTS } from "../observability/analytics";

const trackEventMock = vi.fn();

vi.mock("../observability/analytics", async () => {
  const actual = await vi.importActual<
    typeof import("../observability/analytics")
  >("../observability/analytics");
  return {
    ...actual,
    trackEvent: (...args: unknown[]) => trackEventMock(...args),
  };
});

const openHubModuleWithActionMock = vi.fn();

vi.mock("@shared/lib/modules/hubNav", async () => {
  const actual = await vi.importActual<
    typeof import("@shared/lib/modules/hubNav")
  >("@shared/lib/modules/hubNav");
  return {
    ...actual,
    openHubModuleWithAction: (...args: unknown[]) =>
      openHubModuleWithActionMock(...args),
  };
});

describe("HeroPromiseCard", () => {
  afterEach(cleanup);

  beforeEach(() => {
    trackEventMock.mockClear();
    openHubModuleWithActionMock.mockClear();
  });

  it("renders module-aware headline + body + CTA for finyk", () => {
    render(<HeroPromiseCard moduleId="finyk" />);
    expect(screen.getByText("Твоя зарплата на радарі")).toBeTruthy();
    expect(screen.getByText(/Додай суму витрати/)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Записати першу витрату/ }),
    ).toBeTruthy();
  });

  it("renders module-aware headline + body + CTA for routine", () => {
    render(<HeroPromiseCard moduleId="routine" />);
    expect(screen.getByText("Твій тиждень тут")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Створити звичку зараз/ }),
    ).toBeTruthy();
  });

  it("does NOT render any «N/4 розділів» activation-bar regression copy", () => {
    // PR-09 exists to delete the «N/4 розділів» framing; ship-guard
    // here makes sure no copy edit accidentally re-introduces it via
    // the HeroPromiseCard render path.
    render(<HeroPromiseCard moduleId="fizruk" />);
    expect(document.body.textContent ?? "").not.toMatch(/\d\s*\/\s*\d/);
    expect(document.body.textContent ?? "").not.toMatch(
      /розділ(ів|и)\s*готов/i,
    );
  });

  it("fires `hero_promise_shown` exactly once per mount", () => {
    render(<HeroPromiseCard moduleId="finyk" />);
    const shownCalls = trackEventMock.mock.calls.filter(
      ([name]) => name === ANALYTICS_EVENTS.HERO_PROMISE_SHOWN,
    );
    expect(shownCalls.length).toBe(1);
    expect(shownCalls[0]?.[1]).toEqual({ module: "finyk" });
  });

  it("routes the CTA via `openHubModuleWithAction` + emits `hero_promise_cta`", () => {
    render(<HeroPromiseCard moduleId="finyk" />);
    fireEvent.click(
      screen.getByRole("button", { name: /Записати першу витрату/ }),
    );
    expect(openHubModuleWithActionMock).toHaveBeenCalledWith(
      "finyk",
      "add_expense",
    );
    const ctaCalls = trackEventMock.mock.calls.filter(
      ([name]) => name === ANALYTICS_EVENTS.HERO_PROMISE_CTA,
    );
    expect(ctaCalls.length).toBe(1);
    expect(ctaCalls[0]?.[1]).toEqual({
      module: "finyk",
      action: "add_expense",
    });
  });

  it("delegates the CTA when an onCta override is provided", () => {
    const onCta = vi.fn();
    render(<HeroPromiseCard moduleId="nutrition" onCta={onCta} />);
    fireEvent.click(screen.getByRole("button", { name: /Додати прийом їжі/ }));
    expect(onCta).toHaveBeenCalledWith("nutrition", "add_meal");
    // The default hubNav router must NOT run when an override fires —
    // otherwise tests covering custom routes would double-dispatch.
    expect(openHubModuleWithActionMock).not.toHaveBeenCalled();
  });
});
