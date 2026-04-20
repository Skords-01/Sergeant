/**
 * Owns the React state that reflects the cloud-sync lifecycle
 * (`state`, `lastSyncAt`, `syncError`) together with an in-flight
 * concurrency guard. The orchestrator (`useCloudSync`) composes these
 * into an `engineArgs` bag once, and for each run passes freshly bound
 * callbacks (tied to a monotonic `syncId`) into the engine.
 *
 * This is a leaner port of the web
 * `apps/web/src/core/cloudSync/hook/useSyncCallbacks.ts`. We drop the
 * `claimBusy` / `runBypassed` escape hatches — they exist on web
 * exclusively to support the data-migration modal, which is Phase 4+
 * on mobile and not wired up yet.
 */
import { useCallback, useRef, useState } from "react";
import { toSyncError } from "../errorNormalizer";
import type { SyncCallbacks, SyncError, SyncState } from "../types";

export interface SyncLifecycle extends SyncCallbacks {
  // Legacy field names — kept so ported web code compiles unchanged.
  syncing: boolean;
  lastSync: Date | null;
  syncError: string | null;

  // Explicit, self-documenting aliases.
  isSyncing: boolean;
  lastSyncAt: Date | null;
  hasError: boolean;

  state: SyncState;
  syncErrorDetail: SyncError | null;

  runExclusive<T>(
    engine: (cb: SyncCallbacks) => Promise<T>,
    fallback: T,
  ): Promise<T>;
}

interface InFlightGuard {
  isBusy(): boolean;
  tryAcquire(): boolean;
  release(): void;
}

function createInFlightGuard(): InFlightGuard {
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
  };
}

export function useSyncCallbacks(): SyncLifecycle {
  const [state, setStateValue] = useState<SyncState>("idle");
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [syncErrorDetail, setSyncErrorDetail] = useState<SyncError | null>(
    null,
  );

  const stateRef = useRef<SyncState>("idle");
  const guardRef = useRef<InFlightGuard>(createInFlightGuard());
  const syncIdCounterRef = useRef<number>(0);
  const activeSyncIdRef = useRef<number>(0);

  const setState = useCallback((next: SyncState) => {
    if (stateRef.current === next) return;
    stateRef.current = next;
    setStateValue(next);
  }, []);

  const buildBoundCallbacks = useCallback(
    (syncId: number): SyncCallbacks => ({
      onStart: () => {
        if (activeSyncIdRef.current !== syncId) return;
        setState("syncing");
        setErrorMessage(null);
        setSyncErrorDetail(null);
      },
      onSuccess: (when: Date) => {
        if (activeSyncIdRef.current !== syncId) return;
        setLastSyncAt(when);
        setErrorMessage(null);
        setSyncErrorDetail(null);
        setState("success");
      },
      onError: (message: string) => {
        if (activeSyncIdRef.current !== syncId) return;
        setErrorMessage(message);
        setState("error");
      },
      onErrorRaw: (err: unknown) => {
        if (activeSyncIdRef.current !== syncId) return;
        setSyncErrorDetail(toSyncError(err));
      },
      onSettled: () => {
        if (activeSyncIdRef.current !== syncId) return;
        if (stateRef.current === "syncing") setState("idle");
      },
    }),
    [setState],
  );

  // A permissive top-level bag used only when runExclusive declines to
  // run (because another sync is in flight). These callbacks are
  // no-ops at the hook layer; engines called directly from tests use
  // the bound versions above.
  const noopCallbacks: SyncCallbacks = {
    onStart: () => {},
    onSuccess: () => {},
    onError: () => {},
    onErrorRaw: () => {},
    onSettled: () => {},
  };

  const runExclusive = useCallback(
    async <T>(
      engine: (cb: SyncCallbacks) => Promise<T>,
      fallback: T,
    ): Promise<T> => {
      if (!guardRef.current.tryAcquire()) return fallback;
      const id = ++syncIdCounterRef.current;
      activeSyncIdRef.current = id;
      const bound = buildBoundCallbacks(id);
      try {
        return await engine(bound);
      } finally {
        guardRef.current.release();
      }
    },
    [buildBoundCallbacks],
  );

  const isSyncing = state === "syncing";
  const hasError = state === "error";

  return {
    syncing: isSyncing,
    lastSync: lastSyncAt,
    syncError: errorMessage,
    isSyncing,
    lastSyncAt,
    hasError,
    state,
    syncErrorDetail,
    runExclusive,
    ...noopCallbacks,
  };
}
