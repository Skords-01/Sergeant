// Side-effect import: ensure the dirty-modules module is evaluated before
// we install the localStorage patch below, so `markModuleDirty` can run
// against an initialized module graph.
import "./state/dirtyModules";

import { ALL_TRACKED_KEYS, keyToModule } from "./config";
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

if (!window.__hubSyncPatched) {
  window.__hubSyncPatched = true;
  localStorage.setItem = function (key: string, value: string) {
    origSetItem(key, value);
    if (ALL_TRACKED_KEYS.has(key)) {
      const mod = keyToModule(key);
      if (mod) markModuleDirty(mod);
      emitSyncEvent();
    }
  };
  localStorage.removeItem = function (key: string) {
    origRemoveItem(key);
    if (ALL_TRACKED_KEYS.has(key)) {
      const mod = keyToModule(key);
      if (mod) markModuleDirty(mod);
      emitSyncEvent();
    }
  };
}

/**
 * Notify the sync system that a storage key changed by other means. If the
 * key belongs to a tracked module, mark that module dirty; always dispatch
 * the SYNC_EVENT so listeners (e.g. debounced push) can react.
 */
export function notifySyncDirty(changedKey?: string): void {
  if (changedKey && ALL_TRACKED_KEYS.has(changedKey)) {
    const mod = keyToModule(changedKey);
    if (mod) markModuleDirty(mod);
  }
  emitSyncEvent();
}
