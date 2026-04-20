// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useStoriesAutoplay } from "../hooks/useStoriesAutoplay";

// Helper: drive requestAnimationFrame with a fake clock, advancing in
// ~16ms frames. jsdom provides `performance.now` already, so we alias
// `vi.advanceTimersByTime` via the rAF polyfill below.
// vitest's fake timers already advance `performance.now()`, so the fake
// rAF just replays queued callbacks at the current (fake) clock value.
function installFakeRaf() {
  let id = 0;
  const callbacks = new Map<number, (t: number) => void>();
  const originalRaf = globalThis.requestAnimationFrame;
  const originalCancel = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
    id += 1;
    callbacks.set(id, cb);
    return id;
  };
  globalThis.cancelAnimationFrame = (handle: number) => {
    callbacks.delete(handle);
  };
  const flush = () => {
    const list = Array.from(callbacks.entries());
    callbacks.clear();
    const now = performance.now();
    for (const [, cb] of list) cb(now);
  };
  const restore = () => {
    globalThis.requestAnimationFrame = originalRaf;
    globalThis.cancelAnimationFrame = originalCancel;
  };
  return { flush, restore };
}

describe("useStoriesAutoplay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts at 0 progress", () => {
    const raf = installFakeRaf();
    const { result } = renderHook(() =>
      useStoriesAutoplay({
        key: 0,
        durationMs: 1000,
        paused: false,
        onAdvance: () => {},
      }),
    );
    expect(result.current).toBe(0);
    raf.restore();
  });

  it("calls onAdvance after durationMs elapses", () => {
    const raf = installFakeRaf();
    const onAdvance = vi.fn();
    renderHook(() =>
      useStoriesAutoplay({
        key: 0,
        durationMs: 1000,
        paused: false,
        onAdvance,
      }),
    );
    act(() => {
      vi.advanceTimersByTime(500);
      raf.flush();
    });
    expect(onAdvance).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(600);
      raf.flush();
    });
    expect(onAdvance).toHaveBeenCalledTimes(1);
    raf.restore();
  });

  it("does not tick while paused", () => {
    const raf = installFakeRaf();
    const onAdvance = vi.fn();
    const { result, rerender } = renderHook(
      ({ paused }: { paused: boolean }) =>
        useStoriesAutoplay({
          key: 0,
          durationMs: 1000,
          paused,
          onAdvance,
        }),
      { initialProps: { paused: true } },
    );
    act(() => {
      vi.advanceTimersByTime(2000);
      raf.flush();
    });
    expect(onAdvance).not.toHaveBeenCalled();
    expect(result.current).toBe(0);

    rerender({ paused: false });
    act(() => {
      vi.advanceTimersByTime(1100);
      raf.flush();
    });
    expect(onAdvance).toHaveBeenCalledTimes(1);
    raf.restore();
  });

  it("resets progress to 0 when key changes", () => {
    const raf = installFakeRaf();
    const { result, rerender } = renderHook(
      ({ key }: { key: number }) =>
        useStoriesAutoplay({
          key,
          durationMs: 1000,
          paused: false,
          onAdvance: () => {},
        }),
      { initialProps: { key: 0 } },
    );
    act(() => {
      vi.advanceTimersByTime(500);
      raf.flush();
    });
    expect(result.current).toBeGreaterThan(0);
    rerender({ key: 1 });
    expect(result.current).toBe(0);
    raf.restore();
  });
});
