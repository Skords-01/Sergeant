import { useEffect } from "react";
import { SYNC_EVENT } from "../config";
import { replayOfflineQueue } from "../engine/replay";
import { httpTransport } from "../engine/transport";
import { getDirtyModules } from "../state/dirtyModules";

const DEBOUNCE_MS = 5000;
const PERIODIC_MS = 2 * 60 * 1000;

/**
 * Wires the three retry triggers that drive dirty-module pushes while a
 * user is signed in:
 *   - browser `online` event  → replay the offline queue, then `onTrigger`
 *   - `SYNC_EVENT` (tracked localStorage write) → debounced by 5s so bursts
 *     coalesce into a single push
 *   - 2-minute interval → `onTrigger` only if there are dirty modules
 *
 * The effect is a no-op while `enabled` is `false` (e.g. no signed-in user).
 */
export function useSyncRetry(enabled: boolean, onTrigger: () => void): void {
  useEffect(() => {
    if (!enabled) return;

    const onOnline = () => {
      replayOfflineQueue(httpTransport).then(onTrigger);
    };

    let debounceId: ReturnType<typeof setTimeout> | null = null;
    const onSyncDirty = () => {
      if (debounceId) clearTimeout(debounceId);
      debounceId = setTimeout(onTrigger, DEBOUNCE_MS);
    };

    const periodic = setInterval(() => {
      if (Object.keys(getDirtyModules()).length > 0) onTrigger();
    }, PERIODIC_MS);

    window.addEventListener("online", onOnline);
    window.addEventListener(SYNC_EVENT, onSyncDirty);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener(SYNC_EVENT, onSyncDirty);
      if (debounceId) clearTimeout(debounceId);
      clearInterval(periodic);
    };
  }, [enabled, onTrigger]);
}
