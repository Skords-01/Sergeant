// Side-effect import: ensure the dirty-modules module is evaluated before
// we install the localStorage patch below, so `markModuleDirty` can run
// against an initialized module graph.
import "./state/dirtyModules";

import { ALL_TRACKED_KEYS, keyToModule } from "./config";
import { syncLog } from "./logger";
import { markModuleDirty } from "./state/dirtyModules";
import { emitSyncEvent } from "./state/events";

// Capture raw references BEFORE installing the patch so `clearSyncManagedData`
// can bypass dirty-marking when wiping a previous user's data.
const origSetItem = localStorage.setItem.bind(localStorage);
const origRemoveItem = localStorage.removeItem.bind(localStorage);

export const rawRemoveItem: (key: string) => void = origRemoveItem;

declare global {
  interface Window {
    __hubSyncPatched?: boolean;
  }
}

/**
 * Queue layer — single entry point for "a local change just happened".
 *
 * If the changed localStorage key belongs to a tracked module, mark that
 * module dirty (persisted through `DIRTY_MODULES_KEY`). Always dispatch the
 * `SYNC_EVENT` so the scheduler layer can debounce and fire a sync. Keeping
 * this as the one place that writes to the dirty map avoids the earlier
 * duplication between the patched `setItem`/`removeItem` and the public
 * `notifySyncDirty` helper.
 */
export function enqueueChange(changedKey?: string): void {
  let module: string | null = null;
  if (changedKey && ALL_TRACKED_KEYS.has(changedKey)) {
    module = keyToModule(changedKey);
    if (module) markModuleDirty(module);
  }
  syncLog.enqueue({ key: changedKey, module });
  emitSyncEvent();
}

/**
 * Kept for backward compatibility with existing consumers and tests that
 * import `notifySyncDirty` from the barrel. New code should call
 * `enqueueChange` directly.
 */
export const notifySyncDirty = enqueueChange;

if (!window.__hubSyncPatched) {
  window.__hubSyncPatched = true;
  localStorage.setItem = function (key: string, value: string) {
    origSetItem(key, value);
    if (ALL_TRACKED_KEYS.has(key)) enqueueChange(key);
  };
  localStorage.removeItem = function (key: string) {
    origRemoveItem(key);
    if (ALL_TRACKED_KEYS.has(key)) enqueueChange(key);
  };
}
