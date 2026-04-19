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
 * React hook that orchestrates the cloud-sync engine. Owns React state
 * (`syncing`, `lastSync`, `syncError`, `migrationPending`) and wires the
 * engine to retry triggers (online listener, 5s debounce on SYNC_EVENT,
 * 2-min periodic) and the initial-sync-on-user effect.
 */
export function useCloudSync(user: CurrentUser | null | undefined) {
  const [migrationPending, setMigrationPending] = useState(false);
  const { engineArgs, lifecycle } = useEngineArgs(user);
  const { syncing, lastSync, syncError, runExclusive, claimBusy } = lifecycle;

  const doPushDirty = useCallback(
    () => runExclusive(() => pushDirty(engineArgs), undefined),
    [engineArgs, runExclusive],
  );

  const doPushAll = useCallback(
    () => runExclusive(() => pushAll(engineArgs), undefined),
    [engineArgs, runExclusive],
  );

  const doPullAll = useCallback(
    () => runExclusive(() => pullAll(engineArgs), false),
    [engineArgs, runExclusive],
  );

  const doInitialSync = useCallback(
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

  const doUploadLocalData = useCallback(async () => {
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
  useInitialSyncOnUser(user, doInitialSync, clearMigrationPending);

  useSyncRetry(!!user, doPushDirty);

  return {
    syncing,
    lastSync,
    syncError,
    pushAll: doPushAll,
    pullAll: doPullAll,
    migrationPending,
    uploadLocalData: doUploadLocalData,
    skipMigration,
  };
}
