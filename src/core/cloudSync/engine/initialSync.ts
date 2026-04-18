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
import type { CurrentUser, ModulePayload, PullAllModuleBody } from "../types";
import { replayOfflineQueue } from "./replay";
import type { Transport } from "./transport";

export interface InitialSyncArgs {
  user: CurrentUser | null | undefined;
  transport: Transport;
  onStart(): void;
  onSuccess(when: Date): void;
  onError(message: string): void;
  onNeedMigration(): void;
  onSettled(): void;
}

/**
 * First-run sync after auth: drain offline queue, pull cloud state, and
 * reconcile with local state via `resolveInitialSync`. Behavior matches the
 * original `initialSync` in `useCloudSync.js` 1:1.
 */
export async function initialSync(args: InitialSyncArgs): Promise<void> {
  const {
    user,
    transport,
    onStart,
    onSuccess,
    onError,
    onNeedMigration,
    onSettled,
  } = args;
  onStart();
  try {
    await replayOfflineQueue(transport);

    const res = await transport.pullAll();
    if (!res.ok) throw new Error("Initial sync failed");
    const { modules: cloudModules } = await res.json();

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
        return;
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
            const pushRes = await transport.pushAll(modules);
            if (pushRes.ok) clearAllDirty();
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
  } catch (err) {
    onError(err instanceof Error ? err.message : String(err));
  } finally {
    onSettled();
  }
}
