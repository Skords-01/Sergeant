import { SYNC_MODULES } from "../config";
import { isModulePushSuccess } from "../conflict/pushSuccess";
import { addToOfflineQueue } from "../queue/offlineQueue";
import {
  clearAllDirty,
  clearDirtyModule,
  getDirtyModules,
  getModuleModifiedTimes,
} from "../state/dirtyModules";
import { collectModuleData } from "../state/moduleData";
import { setModuleVersion } from "../state/versions";
import type { CurrentUser, ModulePayload } from "../types";
import { replayOfflineQueue } from "./replay";
import type { Transport } from "./transport";

export interface PushArgs {
  user: CurrentUser | null | undefined;
  transport: Transport;
  onStart(): void;
  onSuccess(when: Date): void;
  onError(message: string): void;
  onSettled(): void;
}

/**
 * Push all currently-dirty modules. Behavior matches the original
 * `pushDirty` in `useCloudSync.js`:
 *   - offline → enqueue and return
 *   - online  → replay any queued payload first, then push
 *   - success → clear dirty flags for modules whose modifiedAt did not
 *     advance during the request (mid-flight changes are preserved)
 *   - failure → re-queue the exact payload we attempted to push
 */
export async function pushDirty(args: PushArgs): Promise<void> {
  const { user, transport, onStart, onSuccess, onError, onSettled } = args;
  const dirty = getDirtyModules();
  const dirtyMods = Object.keys(dirty);
  if (dirtyMods.length === 0) return;

  onStart();
  // Snapshot modified timestamps at push-start. After the server responds we
  // only clear a module's dirty flag if its modifiedAt hasn't advanced —
  // otherwise a change that happened mid-request would be silently dropped.
  const modifiedSnapshot = getModuleModifiedTimes();
  const modules: Record<string, ModulePayload> = {};
  for (const mod of dirtyMods) {
    const data = collectModuleData(mod);
    if (data && Object.keys(data).length > 0) {
      modules[mod] = {
        data,
        clientUpdatedAt: modifiedSnapshot[mod] || new Date().toISOString(),
      };
    }
  }
  try {
    if (Object.keys(modules).length === 0) {
      clearAllDirty();
      return;
    }

    if (!navigator.onLine) {
      addToOfflineQueue({ type: "push", modules });
      return;
    }

    await replayOfflineQueue(transport);

    const res = await transport.pushAll(modules);
    if (!res.ok) throw new Error("Push failed");

    const result = await res.json();
    const currentModified = getModuleModifiedTimes();
    if (result?.results) {
      for (const [mod, r] of Object.entries(result.results)) {
        if (user?.id && r?.version) setModuleVersion(user.id, mod, r.version);
        if (!isModulePushSuccess(r)) continue;
        // Only clear dirty if no newer change landed while we were pushing.
        if (currentModified[mod] === modifiedSnapshot[mod]) {
          clearDirtyModule(mod);
        }
      }
    }

    onSuccess(new Date());
  } catch (err) {
    // Re-queue the exact payload we attempted to push rather than
    // re-collecting, which would race with changes that happened during the
    // failed request.
    if (Object.keys(modules).length > 0) {
      addToOfflineQueue({ type: "push", modules });
    }
    onError(err instanceof Error ? err.message : String(err));
  } finally {
    onSettled();
  }
}

/**
 * Push every sync-managed module regardless of dirty state. Used for manual
 * "sync now" actions. Same offline/online semantics as `pushDirty`, but on
 * success all dirty flags are cleared (not just those matching the snapshot).
 */
export async function pushAll(args: PushArgs): Promise<void> {
  const { user, transport, onStart, onSuccess, onError, onSettled } = args;
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
    if (Object.keys(modules).length === 0) return;

    if (!navigator.onLine) {
      addToOfflineQueue({ type: "push", modules });
      return;
    }

    const res = await transport.pushAll(modules);
    if (!res.ok) throw new Error("Push failed");

    const result = await res.json();
    if (user?.id && result?.results) {
      for (const [mod, r] of Object.entries(result.results)) {
        if (r?.version) setModuleVersion(user.id, mod, r.version);
      }
    }
    clearAllDirty();
    onSuccess(new Date());
  } catch (err) {
    onError(err instanceof Error ? err.message : String(err));
  } finally {
    onSettled();
  }
}
