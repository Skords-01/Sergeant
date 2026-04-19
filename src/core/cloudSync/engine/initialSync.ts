import { syncApi } from "@shared/api";
import { SYNC_MODULES } from "../config";
import { resolveInitialSync } from "../conflict/resolver";
import {
  clearAllDirty,
  getDirtyModules,
  getModuleModifiedTimes,
} from "../state/dirtyModules";
import { isMigrationDone, markMigrationDone } from "../state/migration";
import {
  applyModuleData,
  collectModuleData,
  hasLocalData,
} from "../state/moduleData";
import { getModuleVersion, setModuleVersion } from "../state/versions";
import type {
  CurrentUser,
  ModulePayload,
  PullAllModuleBody,
  PullAllResponse,
} from "../types";
import { replayOfflineQueue } from "./replay";

export interface InitialSyncArgs {
  user: CurrentUser | null | undefined;
  onStart(): void;
  onSuccess(when: Date): void;
  onError(message: string): void;
  onNeedMigration(): void;
  onSettled(): void;
}

/**
 * First-run sync after auth: drain offline queue, pull cloud state, and
 * reconcile with local state via `resolveInitialSync`.
 *
 * Returns `true` when the run completed without throwing (including the
 * `needMigration` branch, which is a completed decision — not a failure —
 * and whose resolution happens via the modal). Returns `false` if any
 * network / API error was caught, so the caller can decide whether to
 * retry. Behavior otherwise matches the original `initialSync` in
 * `useCloudSync.js` 1:1.
 */
export async function initialSync(args: InitialSyncArgs): Promise<boolean> {
  const { user, onStart, onSuccess, onError, onNeedMigration, onSettled } =
    args;
  onStart();
  try {
    await replayOfflineQueue();

    const { modules: cloudModules } =
      (await syncApi.pullAll()) as PullAllResponse;

    const plan = resolveInitialSync({
      cloud: cloudModules as
        | Record<string, PullAllModuleBody | undefined>
        | undefined,
      hasAnyLocalData: Object.keys(SYNC_MODULES).some(hasLocalData),
      migrated: isMigrationDone(user?.id),
      userId: user?.id,
      modifiedTimes: getModuleModifiedTimes(),
      getLocalVersion: getModuleVersion,
      dirtyModules: getDirtyModules(),
    });

    switch (plan.kind) {
      case "adoptCloud": {
        for (const { mod, data, version } of plan.applyModules) {
          applyModuleData(mod, data);
          if (user?.id && version) {
            setModuleVersion(user.id, mod, version);
          }
        }
        if (!isMigrationDone(user?.id)) markMigrationDone(user?.id);
        break;
      }
      case "needMigration": {
        onNeedMigration();
        return true;
      }
      case "merge": {
        for (const { mod, data } of plan.applyModules) {
          applyModuleData(mod, data);
        }
        if (user?.id) {
          for (const { mod, version } of plan.setVersions) {
            setModuleVersion(user.id, mod, version);
          }
        }
        if (plan.dirtyMods.length > 0) {
          const modifiedTimes = getModuleModifiedTimes();
          const modules: Record<string, ModulePayload> = {};
          for (const mod of plan.dirtyMods) {
            const data = collectModuleData(mod);
            if (data && Object.keys(data).length > 0) {
              modules[mod] = {
                data,
                clientUpdatedAt: modifiedTimes[mod] || new Date().toISOString(),
              };
            }
          }
          if (Object.keys(modules).length > 0) {
            // Let ApiError propagate to the outer catch so onError fires and
            // markMigrationDone is skipped — matches pre-refactor behavior
            // where `if (pushRes.ok) clearAllDirty()` combined with the
            // syncApi-throwing transport meant a push failure aborted the
            // whole initialSync.
            await syncApi.pushAll(modules);
            clearAllDirty();
          }
        }
        if (!isMigrationDone(user?.id)) markMigrationDone(user?.id);
        break;
      }
      case "noop": {
        if (!isMigrationDone(user?.id)) markMigrationDone(user?.id);
        break;
      }
    }

    onSuccess(new Date());
    return true;
  } catch (err) {
    onError(err instanceof Error ? err.message : String(err));
    return false;
  } finally {
    onSettled();
  }
}
