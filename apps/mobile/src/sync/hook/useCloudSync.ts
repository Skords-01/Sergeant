/**
 * Mobile orchestrator hook. Mirrors the public surface of
 * `apps/web/src/core/cloudSync/hook/useCloudSync.ts`:
 *
 *   - accepts a `user` (for per-user version tracking)
 *   - returns `{ isSyncing, lastSyncAt, hasError, state,
 *     syncErrorDetail, pushAll, pullAll, syncing, lastSync,
 *     syncError }`
 *   - owns the debounced "run when dirty" scheduler
 *   - runs `initialSync` (via `pullAll` + queue replay) once per
 *     authenticated user
 *   - replays the offline queue when NetInfo reports online
 *
 * This is intentionally slimmer than the web version: the migration
 * modal and debug panel exist only on web (Phase 4+ on mobile), so
 * `migrationPending`/`uploadLocalData`/`skipMigration` are stubbed
 * out to keep the shape compatible with ported consumers but never
 * surface true.
 */
import { useCallback, useEffect, useMemo, useRef } from "react";
import { pullAll as engPullAll } from "../engine/pull";
import { pushAll as engPushAll, pushDirty } from "../engine/push";
import { replayOfflineQueue } from "../engine/replay";
import { onSyncEvent, SYNC_EVENT } from "../events";
import { onOnlineChange, startOnlineTracker } from "../net/online";
import { getOfflineQueue } from "../queue/offlineQueue";
import { getDirtyModules } from "../state/dirtyModules";
import type { CurrentUser, SyncCallbacks } from "../types";
import { useSyncCallbacks } from "./useSyncCallbacks";

// Debounce match the web default (5s): short enough that users rarely
// notice latency between a change and it reaching the server, long
// enough to coalesce bursts like rapid form edits into one push.
const DEBOUNCE_MS = 5_000;

// Periodic retry cadence when there's pending work but we've been
// unable to flush it (e.g. persistent 5xx). Same as web (2 min).
const PERIODIC_RETRY_MS = 2 * 60 * 1_000;

export interface UseCloudSyncReturn {
  // New, self-documenting names.
  isSyncing: boolean;
  lastSyncAt: Date | null;
  hasError: boolean;
  state: ReturnType<typeof useSyncCallbacks>["state"];
  syncErrorDetail: ReturnType<typeof useSyncCallbacks>["syncErrorDetail"];

  // Legacy aliases for ported web code that reads the old field
  // names. These re-alias the new fields, never contradict them.
  syncing: boolean;
  lastSync: Date | null;
  syncError: string | null;

  pushAll: () => Promise<void>;
  pullAll: () => Promise<boolean>;

  // Migration-modal placeholders — wired up in Phase 4+ when the
  // modal is ported.
  migrationPending: false;
  uploadLocalData: () => Promise<void>;
  skipMigration: () => void;
}

export function useCloudSync(
  user: CurrentUser | null | undefined,
): UseCloudSyncReturn {
  const lifecycle = useSyncCallbacks();
  const {
    isSyncing,
    lastSyncAt,
    hasError,
    state,
    syncErrorDetail,
    syncing,
    lastSync,
    syncError,
    runExclusive,
  } = lifecycle;

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const userRef = useRef<CurrentUser | null | undefined>(user);
  userRef.current = user;

  const runPushDirty = useCallback(
    (cb: SyncCallbacks) =>
      pushDirty({ user: userRef.current, ...cb }).then(() => undefined),
    [],
  );

  const scheduleSync = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      void runExclusive(runPushDirty, undefined);
    }, DEBOUNCE_MS);
  }, [runExclusive, runPushDirty]);

  // (1) Scheduler: listen for dirty events fired by `enqueueChange`.
  useEffect(() => {
    const unsubscribe = onSyncEvent(SYNC_EVENT, scheduleSync);
    return () => {
      unsubscribe();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [scheduleSync]);

  // (2) Periodic retry: if there's pending work, try again every 2min
  // so a stuck device eventually flushes without requiring a user
  // interaction. No-op when queue/dirty are empty.
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const hasPending =
        Object.keys(getDirtyModules()).length > 0 ||
        getOfflineQueue().length > 0;
      if (hasPending) void runExclusive(runPushDirty, undefined);
    }, PERIODIC_RETRY_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [runExclusive, runPushDirty]);

  // (3) NetInfo-driven replay. On offline → online transitions,
  // replay the offline queue, then flush any dirty modules that
  // accumulated while we were offline.
  useEffect(() => {
    const unsubTracker = startOnlineTracker();
    const unsubOnline = onOnlineChange(() => {
      void runExclusive(async (cb) => {
        await replayOfflineQueue();
        await pushDirty({ user: userRef.current, ...cb });
      }, undefined);
    });
    return () => {
      unsubOnline();
      unsubTracker();
    };
  }, [runExclusive]);

  // (4) Initial sync on user-id change: drain queue + pull fresh
  // cloud state so a just-signed-in device adopts server data.
  const lastUserRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const id = user?.id ?? null;
    if (lastUserRef.current === id) return;
    lastUserRef.current = id;
    if (!id) return;
    void runExclusive(async (cb) => {
      await replayOfflineQueue();
      await engPullAll({ user: userRef.current, ...cb });
    }, undefined);
  }, [user?.id, runExclusive]);

  const pushAllPublic = useCallback(
    () =>
      runExclusive(
        (cb) => engPushAll({ user: userRef.current, ...cb }),
        undefined,
      ),
    [runExclusive],
  );

  const pullAllPublic = useCallback(
    () =>
      runExclusive((cb) => engPullAll({ user: userRef.current, ...cb }), false),
    [runExclusive],
  );

  const uploadLocalData = useCallback(async () => {
    // Placeholder — the web implementation gates this behind the
    // migration modal. Treated as "push everything" on mobile for now.
    await pushAllPublic();
  }, [pushAllPublic]);

  const skipMigration = useCallback(() => {
    // Placeholder — no modal to dismiss on mobile yet.
  }, []);

  return useMemo(
    () => ({
      isSyncing,
      lastSyncAt,
      hasError,
      state,
      syncErrorDetail,
      syncing,
      lastSync,
      syncError,
      pushAll: pushAllPublic,
      pullAll: pullAllPublic,
      migrationPending: false as const,
      uploadLocalData,
      skipMigration,
    }),
    [
      isSyncing,
      lastSyncAt,
      hasError,
      state,
      syncErrorDetail,
      syncing,
      lastSync,
      syncError,
      pushAllPublic,
      pullAllPublic,
      uploadLocalData,
      skipMigration,
    ],
  );
}
