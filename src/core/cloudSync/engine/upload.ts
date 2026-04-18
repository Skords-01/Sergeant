import { SYNC_MODULES } from "../config";
import { clearAllDirty, getModuleModifiedTimes } from "../state/dirtyModules";
import { markMigrationDone } from "../state/migration";
import { collectModuleData } from "../state/moduleData";
import type { CurrentUser, ModulePayload } from "../types";
import type { Transport } from "./transport";

export interface UploadArgs {
  user: CurrentUser | null | undefined;
  transport: Transport;
  onStart(): void;
  onSuccess(when: Date): void;
  onError(message: string): void;
  onMigrated(): void;
  onSettled(): void;
}

/**
 * Upload all local data to the cloud and mark the migration as done for this
 * user. Used by the "upload local → cloud" branch of the first-run flow.
 */
export async function uploadLocalData(args: UploadArgs): Promise<void> {
  const {
    user,
    transport,
    onStart,
    onSuccess,
    onError,
    onMigrated,
    onSettled,
  } = args;
  if (!user?.id) return;
  onStart();
  try {
    const modifiedTimes = getModuleModifiedTimes();
    const modules: Record<string, ModulePayload> = {};
    for (const mod of Object.keys(SYNC_MODULES)) {
      const data = collectModuleData(mod);
      if (data && Object.keys(data).length > 0) {
        modules[mod] = {
          data,
          clientUpdatedAt: modifiedTimes[mod] || new Date().toISOString(),
        };
      }
    }
    if (Object.keys(modules).length > 0) {
      const res = await transport.pushAll(modules);
      if (!res.ok) throw new Error("Upload failed");
    }
    markMigrationDone(user.id);
    clearAllDirty();
    onSuccess(new Date());
    onMigrated();
  } catch (err) {
    onError(err instanceof Error ? err.message : String(err));
  } finally {
    onSettled();
  }
}
