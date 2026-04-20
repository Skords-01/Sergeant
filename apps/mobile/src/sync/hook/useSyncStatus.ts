/**
 * Lightweight read-only hook that feeds a future `SyncStatusIndicator`.
 * Mirror of `apps/web/src/core/cloudSync/hook/useSyncStatus.ts` — same
 * `{ dirtyCount, queuedCount, isOnline }` shape so the ported
 * indicator component can consume it verbatim.
 *
 * Refresh triggers:
 *   - `SYNC_EVENT`        — a mutation was enqueued
 *   - `SYNC_STATUS_EVENT` — dirty/queue/modified-times persisted
 *   - NetInfo offline → online transitions
 */
import { useEffect, useState } from "react";
import { onSyncEvent, SYNC_EVENT, SYNC_STATUS_EVENT } from "../events";
import { isOnline, onOnlineChange, startOnlineTracker } from "../net/online";
import { getOfflineQueue } from "../queue/offlineQueue";
import { getDirtyModules } from "../state/dirtyModules";

export interface SyncStatusState {
  dirtyCount: number;
  queuedCount: number;
  isOnline: boolean;
}

function snapshot(): SyncStatusState {
  return {
    dirtyCount: Object.keys(getDirtyModules()).length,
    queuedCount: getOfflineQueue().length,
    isOnline: isOnline(),
  };
}

export function useSyncStatus(): SyncStatusState {
  const [state, setState] = useState<SyncStatusState>(snapshot);

  useEffect(() => {
    const refresh = () => setState(snapshot());

    refresh();
    const unsubTracker = startOnlineTracker();
    const unsubStatus = onSyncEvent(SYNC_STATUS_EVENT, refresh);
    const unsubSync = onSyncEvent(SYNC_EVENT, refresh);
    const unsubOnline = onOnlineChange(refresh);

    return () => {
      unsubStatus();
      unsubSync();
      unsubOnline();
      unsubTracker();
    };
  }, []);

  return state;
}
