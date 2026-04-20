import { syncApi } from "@shared/api";
import { SYNC_MODULES } from "../config";
import { clearAllDirty, getModuleModifiedTimes } from "../state/dirtyModules";
import { markMigrationDone } from "../state/migration";
import type { EngineArgs } from "../types";
import { buildModulesPayload } from "./buildPayload";
import { retryAsync } from "./retryAsync";

export type UploadArgs = EngineArgs & {
  onMigrated(): void;
};

/**
 * Upload all local data to the cloud and mark the migration as done for this
 * user. Used by the "upload local → cloud" branch of the first-run flow.
 */
export async function uploadLocalData(args: UploadArgs): Promise<void> {
  const { user, onStart, onSuccess, onError, onMigrated, onSettled } = args;
  if (!user?.id) return;
  onStart();
  try {
    const modules = buildModulesPayload(
      Object.keys(SYNC_MODULES),
      getModuleModifiedTimes(),
    );
    if (Object.keys(modules).length > 0) {
      await retryAsync(() => syncApi.pushAll(modules), {
        label: "uploadLocalData",
      });
    }
    markMigrationDone(user.id);
    clearAllDirty();
    onSuccess(new Date());
    onMigrated();
  } catch (err) {
    args.onErrorRaw?.(err);
    onError(err instanceof Error ? err.message : String(err));
  } finally {
    onSettled();
  }
}
