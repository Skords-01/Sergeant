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
   * `fallback` synchronously. Sets the in-flight flag before calling `fn`
   * and clears it unconditionally once `fn` settles (success OR failure OR
   * early return), so an engine path that returns before its own try/finally
   * cannot leave the guard stuck. `onSettled` is still responsible for
   * clearing `syncing` state inside React; the release here is idempotent
   * with that.
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
 * Pure in-flight guard. Separated from React so the acquire/release contract
 * can be unit-tested without rendering a hook. The React hook below wraps
 * one of these in a ref so it survives re-renders.
 */
export interface InFlightGuard {
  isBusy(): boolean;
  tryAcquire(): boolean;
  release(): void;
  forceClaim(): void;
}

export function createInFlightGuard(): InFlightGuard {
  let busy = false;
  return {
    isBusy: () => busy,
    tryAcquire: () => {
      if (busy) return false;
      busy = true;
      return true;
    },
    release: () => {
      busy = false;
    },
    forceClaim: () => {
      busy = true;
    },
  };
}

/**
 * Runs `fn` iff the guard is free. Always releases the guard on settlement,
 * regardless of whether `fn` resolved, rejected, or returned early without
 * invoking any engine-level callbacks. This is the contract that prevents a
 * stuck-busy state when an engine path (e.g. `pushDirty` with no dirty
 * modules) short-circuits before its own try/finally.
 */
export async function runExclusiveWith<T>(
  guard: InFlightGuard,
  fn: () => Promise<T>,
  fallback: T,
): Promise<T> {
  if (!guard.tryAcquire()) return fallback;
  try {
    return await fn();
  } finally {
    guard.release();
  }
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
  const guardRef = useRef<InFlightGuard>(createInFlightGuard());

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
    guardRef.current.release();
  }, []);

  const runExclusive = useCallback(
    <T>(fn: () => Promise<T>, fallback: T): Promise<T> =>
      runExclusiveWith(guardRef.current, fn, fallback),
    [],
  );

  const claimBusy = useCallback(() => {
    guardRef.current.forceClaim();
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
