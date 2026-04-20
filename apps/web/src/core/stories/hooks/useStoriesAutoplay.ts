import { useEffect, useRef, useState } from "react";

interface Options {
  // Resetting `key` (typically the current slide index) restarts progress.
  key: number | string;
  durationMs: number;
  paused: boolean;
  onAdvance: () => void;
}

/**
 * rAF-driven progress (0–100). Resets to 0 whenever `key` changes, halts
 * while `paused` is true, and calls `onAdvance` at 100%.
 *
 * Uses requestAnimationFrame with wall-clock deltas so the progress bar
 * stays in sync with real time across frame drops. When the tab is
 * hidden the browser stops calling rAF entirely, so we rebase the start
 * time on `visibilitychange` — preventing the progress bar from jumping
 * on resume.
 */
export function useStoriesAutoplay({
  key,
  durationMs,
  paused,
  onAdvance,
}: Options): number {
  const [progress, setProgress] = useState(0);
  // Keep `onAdvance` behind a ref so the animation loop doesn't need to
  // restart every time a parent re-renders with a new callback identity.
  const onAdvanceRef = useRef(onAdvance);
  useEffect(() => {
    onAdvanceRef.current = onAdvance;
  }, [onAdvance]);

  useEffect(() => {
    setProgress(0);
    if (paused) return;
    if (typeof window === "undefined" || typeof performance === "undefined") {
      return;
    }

    let rafId: number | null = null;
    let cancelled = false;
    // Mutable so visibilitychange can rebase without restarting the loop.
    const state = { startTs: performance.now(), lastProgress: 0 };

    const tick = (now: number) => {
      if (cancelled) return;
      const pct = Math.min(100, ((now - state.startTs) / durationMs) * 100);
      state.lastProgress = pct;
      setProgress(pct);
      if (pct >= 100) {
        onAdvanceRef.current();
        return;
      }
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        // Rebase startTs so we resume from the last observed progress
        // rather than crediting hidden-tab time to the current slide.
        state.startTs =
          performance.now() - (state.lastProgress / 100) * durationMs;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [key, durationMs, paused]);

  return progress;
}
