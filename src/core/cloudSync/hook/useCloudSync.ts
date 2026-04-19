import { useCallback, useEffect, useRef, useState } from "react";
import { initialSync } from "../engine/initialSync";
import { pullAll, type PullArgs } from "../engine/pull";
import { pushAll, pushDirty } from "../engine/push";
import { uploadLocalData } from "../engine/upload";
import { markMigrationDone } from "../state/migration";
import { clearSyncManagedData } from "../state/moduleData";
import { rawRemoveItem } from "../storagePatch";
import type { CurrentUser } from "../types";
import { useSyncCallbacks } from "./useSyncCallbacks";
import { useSyncRetry } from "./useSyncRetry";

/**
 * React hook that orchestrates the cloud-sync engine. Owns React state
 * (`syncing`, `lastSync`, `syncError`, `migrationPending`) and timer-based
 * retry policy (online listener, 5s debounce on SYNC_EVENT, 2min periodic).
 */
export function useCloudSync(user: CurrentUser | null | undefined) {
  const [migrationPending, setMigrationPending] = useState(false);
  const {
    syncing,
    lastSync,
    syncError,
    onStart,
    onSuccess,
    onError,
    onSettled,
    runExclusive,
    claimBusy,
  } = useSyncCallbacks();

  const doPushDirty = useCallback(async () => {
    await runExclusive(
      () =>
        pushDirty({
          user,
          onStart,
          onSuccess,
          onError,
          onSettled,
        }),
      undefined,
    );
  }, [user, onStart, onSuccess, onError, onSettled, runExclusive]);

  const doPushAll = useCallback(async () => {
    await runExclusive(
      () =>
        pushAll({
          user,
          onStart,
          onSuccess,
          onError,
          onSettled,
        }),
      undefined,
    );
  }, [user, onStart, onSuccess, onError, onSettled, runExclusive]);

  const doPullAll = useCallback(async () => {
    const pullArgs: PullArgs = {
      user,
      onStart,
      onSuccess,
      onError,
      onSettled,
    };
    return runExclusive(() => pullAll(pullArgs), false);
  }, [user, onStart, onSuccess, onError, onSettled, runExclusive]);

  const doUploadLocalData = useCallback(async () => {
    if (!user?.id) return;
    // Intentionally bypasses the in-flight guard: this is user-initiated
    // from the migration modal and must proceed even if a background retry
    // is mid-flight.
    claimBusy();
    await uploadLocalData({
      user,
      onStart,
      onSuccess,
      onError,
      onMigrated: () => setMigrationPending(false),
      onSettled,
    });
  }, [user, onStart, onSuccess, onError, onSettled, claimBusy]);

  const doInitialSync = useCallback(async (): Promise<boolean> => {
    return runExclusive(
      () =>
        initialSync({
          user,
          onStart,
          onSuccess,
          onError,
          onNeedMigration: () => setMigrationPending(true),
          onSettled,
        }),
      false,
    );
  }, [user, onStart, onSuccess, onError, onSettled, runExclusive]);

  const skipMigration = useCallback(() => {
    if (!user?.id) return;
    markMigrationDone(user.id);
    setMigrationPending(false);
  }, [user]);

  const didInitialSync = useRef(false);
  const lastUserId = useRef<string | null>(null);
  useEffect(() => {
    const uid = user?.id ?? null;
    if (uid !== lastUserId.current) {
      if (lastUserId.current !== null) {
        clearSyncManagedData(rawRemoveItem);
      }
      didInitialSync.current = false;
      lastUserId.current = uid;
      setMigrationPending(false);
    }
    if (!user || didInitialSync.current) return;
    // Reserve the slot before awaiting so concurrent renders don't fire a
    // second initialSync for the same user. If the run fails (network,
    // 5xx, ApiError), release the slot so the next render — or a
    // subsequent user-change effect — can retry. Without this, a transient
    // failure on the very first sign-in would leave the app in a
    // permanently "initial-synced" state with no cloud reconciliation
    // until the page is reloaded.
    didInitialSync.current = true;
    const uidAtStart = user.id;
    doInitialSync().then((ok) => {
      if (ok) return;
      // Only clear the flag if the user is still the same — a user change
      // will reset it anyway and we must not race that reset.
      if (lastUserId.current === uidAtStart) {
        didInitialSync.current = false;
      }
    });
  }, [user, doInitialSync]);

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
