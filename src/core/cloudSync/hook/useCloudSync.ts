import { useCallback, useState } from "react";
import { initialSync } from "../engine/initialSync";
import { pullAll } from "../engine/pull";
import { pushAll, pushDirty } from "../engine/push";
import { uploadLocalData } from "../engine/upload";
import { markMigrationDone } from "../state/migration";
import type { CurrentUser } from "../types";
import { useEngineArgs } from "./useEngineArgs";
import { useInitialSyncOnUser } from "./useInitialSyncOnUser";
import { useSyncRetry } from "./useSyncRetry";

/**
 * Cloud-sync orchestrator. Three clearly-separated layers, read top-down:
 *
 *   1. Queue (where changes accumulate)
 *      Handled outside this hook — the patched `localStorage` in
 *      `storagePatch.ts` calls `enqueueChange` on every write to a tracked
 *      key. That writes the dirty map and dispatches `SYNC_EVENT`.
 *
 *   2. Scheduler (when to run a sync)
 *      `useSyncRetry` wires three triggers — online / change-event /
 *      periodic timer — to the executor below.
 *
 *   3. Executor (how to actually call the API)
 *      The `run*` callbacks below each wrap one engine entry point in the
 *      in-flight guard (`runExclusive`) so we never fire concurrent syncs.
 *
 * Public state surface:
 *   - `isSyncing`   (legacy alias: `syncing`)
 *   - `lastSyncAt`  (legacy alias: `lastSync`)
 *   - `hasError`    derived from the underlying error message; legacy alias
 *                   `syncError` still exposes the raw message.
 *   - `migrationPending` drives the first-run migration modal.
 */
export function useCloudSync(user: CurrentUser | null | undefined) {
  const [migrationPending, setMigrationPending] = useState(false);
  const { engineArgs, lifecycle } = useEngineArgs(user);
  const {
    isSyncing,
    lastSyncAt,
    hasError,
    syncing,
    lastSync,
    syncError,
    runExclusive,
    claimBusy,
  } = lifecycle;

  // --- 3. Executor: API calls, each serialized through the in-flight guard.

  const runSync = useCallback(
    () => runExclusive(() => pushDirty(engineArgs), undefined),
    [engineArgs, runExclusive],
  );

  const runPushAll = useCallback(
    () => runExclusive(() => pushAll(engineArgs), undefined),
    [engineArgs, runExclusive],
  );

  const runPullAll = useCallback(
    () => runExclusive(() => pullAll(engineArgs), false),
    [engineArgs, runExclusive],
  );

  const runInitialSync = useCallback(
    (): Promise<boolean> =>
      runExclusive(
        () =>
          initialSync({
            ...engineArgs,
            onNeedMigration: () => setMigrationPending(true),
          }),
        false,
      ),
    [engineArgs, runExclusive],
  );

  const runUploadLocal = useCallback(async () => {
    if (!user?.id) return;
    // Intentionally bypasses the in-flight guard: this is user-initiated
    // from the migration modal and must proceed even if a background retry
    // is mid-flight.
    claimBusy();
    await uploadLocalData({
      ...engineArgs,
      onMigrated: () => setMigrationPending(false),
    });
  }, [user, engineArgs, claimBusy]);

  const skipMigration = useCallback(() => {
    if (!user?.id) return;
    markMigrationDone(user.id);
    setMigrationPending(false);
  }, [user]);

  const clearMigrationPending = useCallback(
    () => setMigrationPending(false),
    [],
  );

  // --- 2. Scheduler: subscribe the executor to online/change/periodic.

  useInitialSyncOnUser(user, runInitialSync, clearMigrationPending);
  useSyncRetry(!!user, runSync);

  return {
    // Explicit state names.
    isSyncing,
    lastSyncAt,
    hasError,
    // Legacy aliases kept so existing consumers (App.tsx, tests) compile.
    syncing,
    lastSync,
    syncError,
    pushAll: runPushAll,
    pullAll: runPullAll,
    migrationPending,
    uploadLocalData: runUploadLocal,
    skipMigration,
  };
}
