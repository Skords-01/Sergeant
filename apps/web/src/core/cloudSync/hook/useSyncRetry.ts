import { useEffect } from "react";
import { SYNC_EVENT } from "../config";
import { updateDebugSnapshot } from "../debugState";
import { replayOfflineQueue } from "../engine/replay";
import { syncLog } from "../logger";
import { getDirtyModules } from "../state/dirtyModules";

/**
 * How long to wait after a local change before firing a sync. Collapses
 * bursts of writes into a single API call.
 */
const DEBOUNCE_MS = 5000;

/**
 * Fallback cadence: even without change events we retry every 2 minutes as
 * long as there are dirty modules (e.g. after a previous network failure).
 */
const PERIODIC_MS = 2 * 60 * 1000;

/**
 * Wires the three scheduler triggers that drive `runSync` while a user is
 * signed in. Each trigger is one named function so the wiring reads as a
 * flat list of "which event → what we do".
 *
 * Triggers:
 *   - browser `online`     → replay the offline queue, then `runSync`
 *   - `SYNC_EVENT`         → debounced by 5s so bursts coalesce
 *   - 2-minute interval    → `runSync` only if there are dirty modules
 *
 * The effect is a no-op while `enabled` is `false` (e.g. no signed-in user).
 */
export function useSyncRetry(enabled: boolean, runSync: () => void): void {
  useEffect(() => {
    if (!enabled) return;

    const debouncer = createDebouncer(DEBOUNCE_MS);

    const scheduleFromOnline = () => {
      syncLog.scheduleSync({ reason: "online" });
      updateDebugSnapshot({ lastAction: "schedule" });
      replayOfflineQueue().then(runSync);
    };

    const scheduleFromChange = () => {
      syncLog.scheduleSync({ reason: "change" });
      updateDebugSnapshot({ lastAction: "schedule" });
      debouncer.schedule(runSync);
    };

    const scheduleFromTimer = () => {
      if (Object.keys(getDirtyModules()).length === 0) return;
      syncLog.scheduleSync({ reason: "periodic" });
      updateDebugSnapshot({ lastAction: "schedule" });
      runSync();
    };

    const periodicId = setInterval(scheduleFromTimer, PERIODIC_MS);
    window.addEventListener("online", scheduleFromOnline);
    window.addEventListener(SYNC_EVENT, scheduleFromChange);

    return () => {
      window.removeEventListener("online", scheduleFromOnline);
      window.removeEventListener(SYNC_EVENT, scheduleFromChange);
      debouncer.cancel();
      clearInterval(periodicId);
    };
  }, [enabled, runSync]);
}

interface Debouncer {
  schedule(fn: () => void): void;
  cancel(): void;
}

/**
 * Minimal trailing-edge debouncer. Extracted so the scheduler reads as
 * "schedule vs. fire" instead of open-coding `setTimeout`/`clearTimeout`
 * handles next to the event wiring.
 */
function createDebouncer(delayMs: number): Debouncer {
  let pending: ReturnType<typeof setTimeout> | null = null;
  return {
    schedule(fn) {
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => {
        pending = null;
        fn();
      }, delayMs);
    },
    cancel() {
      if (pending) clearTimeout(pending);
      pending = null;
    },
  };
}
