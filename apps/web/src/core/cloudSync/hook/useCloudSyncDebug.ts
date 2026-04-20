import { useEffect, useState } from "react";
import { SYNC_EVENT, SYNC_STATUS_EVENT } from "../config";
import {
  getDebugSnapshot,
  subscribeDebug,
  type CloudSyncDebugSnapshot,
} from "../debugState";
import { getOfflineQueue } from "../queue/offlineQueue";

/**
 * Everything `useCloudSyncDebug` exposes for inline diagnostics: the live
 * `CloudSyncDebugSnapshot` (state machine + last error + last action +
 * sync-id) plus a live `queueSize` reading off the offline queue.
 *
 * This is intended for a dev-only debug panel or `console.log` bindings —
 * NOT the user-facing sync UI. UI consumers should keep using
 * `useCloudSync` / `useSyncStatus`.
 */
export interface CloudSyncDebugView extends CloudSyncDebugSnapshot {
  queueSize: number;
}

function readQueueSize(): number {
  try {
    return getOfflineQueue().length;
  } catch {
    return 0;
  }
}

/**
 * Read-only debug view of the cloud-sync subsystem. Subscribes to the
 * module-level debug snapshot (written by `useSyncCallbacks`, the logger,
 * and the scheduler) plus the existing `SYNC_EVENT` / `SYNC_STATUS_EVENT`
 * window events, so the returned `queueSize` stays in sync without us
 * polling.
 */
export function useCloudSyncDebug(): CloudSyncDebugView {
  const [snapshot, setSnapshot] = useState<CloudSyncDebugSnapshot>(() =>
    getDebugSnapshot(),
  );
  const [queueSize, setQueueSize] = useState<number>(() => readQueueSize());

  useEffect(() => subscribeDebug(setSnapshot), []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setQueueSize(readQueueSize());
    // Prime on mount so a consumer rendered after the queue was populated
    // doesn't wait for the next event to see a non-zero size.
    update();
    window.addEventListener(SYNC_EVENT, update);
    window.addEventListener(SYNC_STATUS_EVENT, update);
    return () => {
      window.removeEventListener(SYNC_EVENT, update);
      window.removeEventListener(SYNC_STATUS_EVENT, update);
    };
  }, []);

  return { ...snapshot, queueSize };
}
