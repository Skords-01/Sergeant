/**
 * Public "a tracked key just changed" entry point.
 *
 * Web can patch `localStorage.setItem` and auto-mark modules dirty on
 * every write (see `apps/web/src/core/cloudSync/storagePatch.ts`).
 * MMKV has no equivalent hook — writes go straight to native — so on
 * mobile we expose an explicit `enqueueChange(key)` that ported
 * modules must call after every persisted mutation.
 *
 * The semantics are identical to the web `enqueueChange`: if the
 * changed key belongs to a tracked sync module, mark that module
 * dirty (so `pushDirty` picks it up) and emit `SYNC_EVENT` so the
 * scheduler's debounced `runSync` fires.
 */
import { ALL_TRACKED_KEYS, keyToModule } from "./config";
import { emitSyncEvent } from "./events";
import { markModuleDirty } from "./state/dirtyModules";

export function enqueueChange(changedKey?: string): void {
  if (changedKey && ALL_TRACKED_KEYS.has(changedKey)) {
    const module = keyToModule(changedKey);
    if (module) markModuleDirty(module);
  }
  emitSyncEvent();
}

/**
 * Kept for backward-compatibility with the web barrel. New code
 * should call `enqueueChange` directly — the name is clearer.
 */
export const notifySyncDirty = enqueueChange;
