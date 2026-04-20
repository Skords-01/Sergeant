// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useHashRoute } from "./useHashRoute";

type FizrukPage = "dashboard" | "workouts" | "exercise";

const options = {
  defaultPage: "dashboard" as FizrukPage,
  validPages: [
    "dashboard",
    "workouts",
    "exercise",
  ] as const satisfies readonly FizrukPage[],
  aliases: { payments: "workouts" } as Readonly<Record<string, FizrukPage>>,
};

function setHash(raw: string) {
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${window.location.search}${raw}`,
  );
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

describe("useHashRoute", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", window.location.pathname);
  });

  afterEach(() => {
    window.history.replaceState(null, "", window.location.pathname);
  });

  it("returns defaultPage for empty hash", () => {
    const { result } = renderHook(() => useHashRoute(options));
    expect(result.current.page).toBe("dashboard");
    expect(result.current.segments).toEqual([]);
  });

  it("parses canonical #page", () => {
    window.location.hash = "workouts";
    const { result } = renderHook(() => useHashRoute(options));
    expect(result.current.page).toBe("workouts");
  });

  it("parses #page/segment tail", () => {
    window.location.hash = "exercise/abc-123";
    const { result } = renderHook(() => useHashRoute(options));
    expect(result.current.page).toBe("exercise");
    expect(result.current.segments).toEqual(["abc-123"]);
  });

  it("normalizes legacy #/page on mount", () => {
    window.location.hash = "/workouts";
    renderHook(() => useHashRoute(options));
    expect(window.location.hash).toBe("#workouts");
  });

  it("resolves aliases", () => {
    window.location.hash = "payments";
    const { result } = renderHook(() => useHashRoute(options));
    expect(result.current.page).toBe("workouts");
  });

  it("falls back to default for unknown pages", () => {
    window.location.hash = "nope";
    const { result } = renderHook(() => useHashRoute(options));
    expect(result.current.page).toBe("dashboard");
  });

  it("responds to hashchange", () => {
    const { result } = renderHook(() => useHashRoute(options));
    expect(result.current.page).toBe("dashboard");
    act(() => setHash("#workouts"));
    expect(result.current.page).toBe("workouts");
  });

  it("navigate() writes to the hash", () => {
    const { result } = renderHook(() => useHashRoute(options));
    act(() => result.current.navigate("workouts"));
    expect(window.location.hash).toBe("#workouts");
  });

  it("navigate() accepts segment path", () => {
    const { result } = renderHook(() => useHashRoute(options));
    act(() => result.current.navigate("exercise/xyz"));
    expect(window.location.hash).toBe("#exercise/xyz");
  });

  it("navigate() is a no-op when the target equals current hash", () => {
    window.location.hash = "workouts";
    const { result } = renderHook(() => useHashRoute(options));
    const before = window.location.hash;
    act(() => result.current.navigate("workouts"));
    expect(window.location.hash).toBe(before);
  });
});
