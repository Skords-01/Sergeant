import { useCallback, useRef, useState } from "react";
import { syncLog } from "../logger";
import type { SyncCallbacks } from "../types";

export type { SyncCallbacks };

export interface SyncLifecycle extends SyncCallbacks {
  // Legacy names — kept because existing consumers (App.tsx, tests) read them.
  syncing: boolean;
  lastSync: Date | null;
  syncError: string | null;
  // Explicit, self-documenting aliases. Prefer these in new code.
  isSyncing: boolean;
  lastSyncAt: Date | null;
  hasError: boolean;
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
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const guardRef = useRef<InFlightGuard>(createInFlightGuard());

  const onStart = useCallback(() => {
    syncLog.syncStart();
    setIsSyncing(true);
    setErrorMessage(null);
  }, []);
  const onSuccess = useCallback((when: Date) => {
    syncLog.syncSuccess({ at: when });
    setLastSyncAt(when);
  }, []);
  const onError = useCallback((message: string) => {
    syncLog.syncError({ message });
    setErrorMessage(message);
  }, []);
  const onSettled = useCallback(() => {
    setIsSyncing(false);
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
    // Legacy aliases (kept to preserve public shape).
    syncing: isSyncing,
    lastSync: lastSyncAt,
    syncError: errorMessage,
    // Explicit names.
    isSyncing,
    lastSyncAt,
    hasError: errorMessage !== null,
    onStart,
    onSuccess,
    onError,
    onSettled,
    runExclusive,
    claimBusy,
  };
}
