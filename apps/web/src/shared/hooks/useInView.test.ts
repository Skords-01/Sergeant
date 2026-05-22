// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useInView } from "./useInView";

// Minimal IntersectionObserver mock
type IOCallback = (entries: Partial<IntersectionObserverEntry>[]) => void;
let capturedCallback: IOCallback | null = null;
let capturedNode: Element | null = null;

class MockIntersectionObserver {
  constructor(cb: IOCallback) {
    capturedCallback = cb;
  }
  observe(node: Element) {
    capturedNode = node;
  }
  disconnect() {
    capturedNode = null;
    capturedCallback = null;
  }
}

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  capturedCallback = null;
  capturedNode = null;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useInView", () => {
  it("starts as false", () => {
    const { result } = renderHook(() => useInView());
    const [, inView] = result.current;
    expect(inView).toBe(false);
  });

  it("attaches observer when ref is applied to a node", () => {
    const { result } = renderHook(() => useInView());
    const [ref] = result.current;
    const div = document.createElement("div");
    act(() => {
      ref(div);
    });
    expect(capturedNode).toBe(div);
  });

  it("flips to true when entry is intersecting", () => {
    const { result } = renderHook(() => useInView());
    const [ref] = result.current;
    const div = document.createElement("div");
    act(() => {
      ref(div);
    });
    act(() => {
      capturedCallback?.([{ isIntersecting: true }]);
    });
    const [, inView] = result.current;
    expect(inView).toBe(true);
  });

  it("does not flip to true when entry is not intersecting", () => {
    const { result } = renderHook(() => useInView());
    const [ref] = result.current;
    const div = document.createElement("div");
    act(() => {
      ref(div);
    });
    act(() => {
      capturedCallback?.([{ isIntersecting: false }]);
    });
    const [, inView] = result.current;
    expect(inView).toBe(false);
  });

  it("stops observing after becoming true (never resets)", () => {
    const { result } = renderHook(() => useInView());
    const [ref] = result.current;
    const div = document.createElement("div");
    act(() => {
      ref(div);
    });
    act(() => {
      capturedCallback?.([{ isIntersecting: true }]);
    });
    // Re-attach ref to same node — observer should not be recreated
    // because inView is already true
    const [ref2] = result.current;
    act(() => {
      ref2(div);
    });
    // capturedNode should be null (disconnect was called, no new observe)
    expect(capturedNode).toBeNull();
  });

  it("disconnects when ref is called with null", () => {
    const { result } = renderHook(() => useInView());
    const [ref] = result.current;
    const div = document.createElement("div");
    act(() => {
      ref(div);
    });
    expect(capturedNode).toBe(div);
    act(() => {
      ref(null);
    });
    expect(capturedNode).toBeNull();
  });
});
