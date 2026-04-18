import { ALL_TRACKED_KEYS, keyToModule } from "./config";
import {
  markModuleDirty,
  getDirtyModules as _unused_getDirty, // keep import so the module graph pulls in state before patching
} from "./state/dirtyModules";
import { emitSyncEvent } from "./state/events";

// Capture raw references BEFORE installing the patch so `clearSyncManagedData`
// can bypass dirty-marking when wiping a previous user's data.
const origSetItem = localStorage.setItem.bind(localStorage);
const origRemoveItem = localStorage.removeItem.bind(localStorage);

export const rawRemoveItem: (key: string) => void = origRemoveItem;

// Reference to satisfy the import (we only want the side-effect of loading
// state/dirtyModules before our patch runs). Prefix with underscore to
// appease no-unused-vars lint rules.
void _unused_getDirty;

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
