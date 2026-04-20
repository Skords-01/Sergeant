import { useCallback, useEffect, useState } from "react";

interface Options {
  total: number;
  onExhausted?: () => void;
}

interface Api {
  index: number;
  next: () => void;
  prev: () => void;
  goto: (i: number) => void;
  reset: () => void;
}

/**
 * Pure navigation state. No refs, no mirrors — the latest `index` is always
 * the one in `useState`. Callbacks are recreated when deps change so
 * consumers always close over the current value.
 *
 * On `total` shrinking below the current index, clamps to the last slide
 * and fires `onExhausted` if clamping would push past zero. Prevents a
 * race where digest updates erase slides out from under a stale index.
 */
export function useStoriesNavigation({ total, onExhausted }: Options): Api {
  const [index, setIndex] = useState(0);

  // Clamp when `total` shrinks. Don't auto-exhaust here (that would close
  // the overlay on every digest mutation); callers use `onExhausted` only
  // on the terminal `next()` call.
  useEffect(() => {
    if (total === 0) return;
    setIndex((i) => (i >= total ? total - 1 : i));
  }, [total]);

  const next = useCallback(() => {
    setIndex((i) => {
      if (i >= total - 1) {
        onExhausted?.();
        return i;
      }
      return i + 1;
    });
  }, [total, onExhausted]);

  const prev = useCallback(() => {
    setIndex((i) => (i > 0 ? i - 1 : 0));
  }, []);

  const goto = useCallback(
    (i: number) => {
      if (i < 0 || i >= total) return;
      setIndex(i);
    },
    [total],
  );

  const reset = useCallback(() => setIndex(0), []);

  return { index, next, prev, goto, reset };
}
