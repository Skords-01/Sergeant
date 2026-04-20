import { useEffect } from "react";

/**
 * PWA-action dispatcher.
 *
 * The host app (src/core/App.tsx) reads `?module=<id>&action=<name>` from
 * the initial URL and passes `pwaAction` down to the active module. Each
 * module historically implemented its own `useEffect` that switched on
 * `pwaAction`, invoked a handler, and called `onPwaActionConsumed`. This
 * hook captures that pattern.
 *
 * Usage:
 *
 *     usePwaAction(pwaAction, onPwaActionConsumed, {
 *       start_workout: () => navigate("workouts"),
 *       add_habit: () => setQuickAddOpen(true),
 *     });
 *
 * Handlers may return a cleanup function (e.g. to cancel a deferred
 * file-picker click) — it is passed through as the effect cleanup.
 */

export type PwaActionHandler = () => void | (() => void);

export function usePwaAction(
  action: string | null | undefined,
  onConsumed: (() => void) | undefined,
  handlers: Record<string, PwaActionHandler>,
): void {
  useEffect(() => {
    if (!action) return;
    const handler = handlers[action];
    if (!handler) return;
    const cleanup = handler();
    onConsumed?.();
    return typeof cleanup === "function" ? cleanup : undefined;
    // handlers is intentionally not in the dep list — callers pass an
    // inline object and we key off the action string, which is the
    // meaningful trigger. This matches the original per-module effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, onConsumed]);
}
