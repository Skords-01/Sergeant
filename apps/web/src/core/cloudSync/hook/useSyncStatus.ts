import { useEffect, useState } from "react";
import { SYNC_EVENT, SYNC_STATUS_EVENT } from "../config";
import { getDirtyModules } from "../state/dirtyModules";
import { getOfflineQueue } from "../queue/offlineQueue";

interface SyncStatusState {
  dirtyCount: number;
  queuedCount: number;
  isOnline: boolean;
}

/**
 * Lightweight hook exposing just the local sync state (dirty modules,
 * offline queue, online status) so UI components can render status
 * indicators without owning the full cloud-sync lifecycle.
 */
export function useSyncStatus(): SyncStatusState {
  const [state, setState] = useState<SyncStatusState>(() => ({
    dirtyCount: Object.keys(getDirtyModules()).length,
    queuedCount: getOfflineQueue().length,
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  }));

  useEffect(() => {
    const refresh = () => {
      setState({
        dirtyCount: Object.keys(getDirtyModules()).length,
        queuedCount: getOfflineQueue().length,
        isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
      });
    };

    refresh();
    window.addEventListener(SYNC_STATUS_EVENT, refresh);
    window.addEventListener(SYNC_EVENT, refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    return () => {
      window.removeEventListener(SYNC_STATUS_EVENT, refresh);
      window.removeEventListener(SYNC_EVENT, refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
    };
  }, []);

  return state;
}
