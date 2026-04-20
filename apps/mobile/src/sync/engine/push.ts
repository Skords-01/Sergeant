/**
 * Push engines: `pushDirty` (default) and `pushAll` (manual "sync
 * now"). Behavioral port of
 * `apps/web/src/core/cloudSync/engine/push.ts`. Differences from web:
 *
 *   - offline check reads `isOnline()` from our NetInfo adapter
 *     instead of `navigator.onLine`
 *   - `syncApi` comes from the mobile `@/sync/api` seam (same shape
 *     though: `apiClient.sync.pushAll` → `PushAllResult`)
 *
 * Contract (unchanged from web):
 *   - offline → enqueue and return
 *   - online  → replay any queued payload first, then push
 *   - success → clear dirty flags for modules whose modifiedAt did
 *     NOT advance during the request (mid-flight changes stay dirty)
 *   - failure → re-queue the exact payload we attempted to push
 */
import { SYNC_MODULES } from "../config";
import { isOnline } from "../net/online";
import { addToOfflineQueue } from "../queue/offlineQueue";
import {
  clearAllDirty,
  clearDirtyModule,
  getDirtyModules,
  getModuleModifiedTimes,
} from "../state/dirtyModules";
import { setModuleVersion } from "../state/versions";
import type { EngineArgs, PushAllResponse } from "../types";
import { syncApi } from "../api";
import { buildModulesPayload } from "./buildPayload";
import { replayOfflineQueue } from "./replay";
import { retryAsync } from "./retryAsync";

export type PushArgs = EngineArgs;

function isModulePushSuccess(r: unknown): boolean {
  if (!r || typeof r !== "object") return false;
  const o = r as { ok?: boolean; error?: unknown; conflict?: boolean };
  if (o.error) return false;
  if (o.conflict) return false;
  return o.ok !== false;
}

export async function pushDirty(args: PushArgs): Promise<void> {
  const { user, onStart, onSuccess, onError, onSettled } = args;
  const dirty = getDirtyModules();
  const dirtyMods = Object.keys(dirty);
  if (dirtyMods.length === 0) return;

  onStart();
  const modifiedSnapshot = getModuleModifiedTimes();
  const modules = buildModulesPayload(dirtyMods, modifiedSnapshot);
  try {
    if (Object.keys(modules).length === 0) {
      clearAllDirty();
      onSuccess(new Date());
      return;
    }

    if (!isOnline()) {
      addToOfflineQueue({ type: "push", modules });
      return;
    }

    await replayOfflineQueue();

    const result = (await retryAsync(() => syncApi.pushAll(modules), {
      label: "pushDirty",
    })) as PushAllResponse;
    const currentModified = getModuleModifiedTimes();
    if (result?.results) {
      for (const [mod, r] of Object.entries(result.results)) {
        if (user?.id && r?.version) setModuleVersion(user.id, mod, r.version);
        if (!isModulePushSuccess(r)) continue;
        if (currentModified[mod] === modifiedSnapshot[mod]) {
          clearDirtyModule(mod);
        }
      }
    }

    onSuccess(new Date());
  } catch (err) {
    if (Object.keys(modules).length > 0) {
      addToOfflineQueue({ type: "push", modules });
    }
    args.onErrorRaw?.(err);
    onError(err instanceof Error ? err.message : String(err));
  } finally {
    onSettled();
  }
}

export async function pushAll(args: PushArgs): Promise<void> {
  const { user, onStart, onSuccess, onError, onSettled } = args;
  onStart();
  try {
    const modules = buildModulesPayload(
      Object.keys(SYNC_MODULES),
      getModuleModifiedTimes(),
    );
    if (Object.keys(modules).length === 0) {
      onSuccess(new Date());
      return;
    }

    if (!isOnline()) {
      addToOfflineQueue({ type: "push", modules });
      return;
    }

    const result = (await retryAsync(() => syncApi.pushAll(modules), {
      label: "pushAll",
    })) as PushAllResponse;
    if (user?.id && result?.results) {
      for (const [mod, r] of Object.entries(result.results)) {
        if (r?.version) setModuleVersion(user.id, mod, r.version);
      }
    }
    clearAllDirty();
    onSuccess(new Date());
  } catch (err) {
    args.onErrorRaw?.(err);
    onError(err instanceof Error ? err.message : String(err));
  } finally {
    onSettled();
  }
}
