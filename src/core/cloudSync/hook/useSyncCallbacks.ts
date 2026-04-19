import { useCallback, useRef, useState } from "react";

/**
 * The four callbacks every engine entry point (pushDirty, pushAll, pullAll,
 * initialSync, uploadLocalData) accepts. Kept as a named shape so the
 * orchestrator can spread them into engine args without enumerating.
 */
export interface SyncCallbacks {
  onStart(): void;
  onSuccess(when: Date): void;
  onError(message: string): void;
  onSettled(): void;
}

export interface SyncLifecycle extends SyncCallbacks {
  syncing: boolean;
  lastSync: Date | null;
  syncError: string | null;
  /**
   * Run `fn` only if no other sync operation is in flight; otherwise return
   * `fallback` synchronously. Sets the in-flight flag before calling `fn`;
   * the flag is cleared by `onSettled` once `fn` completes (success or
   * failure), matching the historical `syncingRef` discipline.
   */
  runExclusive<T>(fn: () => Promise<T>, fallback: T): Promise<T>;
  /**
   * Force the in-flight flag to `true` without checking. Used by
   * user-initiated operations (currently just the migration upload) that
   * must not be blocked by a background retry.
   */
  claimBusy(): void;
}

/**
 * Owns the React state that reflects the cloud-sync lifecycle (`syncing`,
 * `lastSync`, `syncError`) together with the in-flight concurrency guard.
 * The orchestrator composes these into an `engineArgs` bag once and passes
 * that into each engine entry point.
 */
export function useSyncCallbacks(): SyncLifecycle {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const syncingRef = useRef(false);

  const onStart = useCallback(() => {
    setSyncing(true);
    setSyncError(null);
  }, []);
  const onSuccess = useCallback((when: Date) => {
    setLastSync(when);
  }, []);
  const onError = useCallback((message: string) => {
    setSyncError(message);
  }, []);
  const onSettled = useCallback(() => {
    setSyncing(false);
    syncingRef.current = false;
  }, []);

  const runExclusive = useCallback(
    <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
      if (syncingRef.current) return Promise.resolve(fallback);
      syncingRef.current = true;
      return fn();
    },
    [],
  );

  const claimBusy = useCallback(() => {
    syncingRef.current = true;
  }, []);

  return {
    syncing,
    lastSync,
    syncError,
    onStart,
    onSuccess,
    onError,
    onSettled,
    runExclusive,
    claimBusy,
  };
}
