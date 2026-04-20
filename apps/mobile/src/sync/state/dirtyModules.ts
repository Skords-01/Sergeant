/**
 * Per-module "dirty" flag + last-modified timestamp, persisted in MMKV.
 * Mirrors the web implementation at
 * `apps/web/src/core/cloudSync/state/dirtyModules.ts` — same API
 * surface so engine code can be ported with trivial import swaps.
 */
import { safeReadLS, safeWriteLS } from "@/lib/storage";
import { DIRTY_MODULES_KEY, MODULE_MODIFIED_KEY } from "../config";
import { emitStatusEvent } from "../events";

export function getDirtyModules(): Record<string, true> {
  return safeReadLS<Record<string, true>>(DIRTY_MODULES_KEY, {}) || {};
}

export function getModuleModifiedTimes(): Record<string, string> {
  return safeReadLS<Record<string, string>>(MODULE_MODIFIED_KEY, {}) || {};
}

export function markModuleDirty(moduleName: string): void {
  const dirty = getDirtyModules();
  dirty[moduleName] = true;
  safeWriteLS(DIRTY_MODULES_KEY, dirty);
  const modified = getModuleModifiedTimes();
  modified[moduleName] = new Date().toISOString();
  safeWriteLS(MODULE_MODIFIED_KEY, modified);
  emitStatusEvent();
}

export function clearDirtyModule(moduleName: string): void {
  const dirty = getDirtyModules();
  delete dirty[moduleName];
  safeWriteLS(DIRTY_MODULES_KEY, dirty);
  emitStatusEvent();
}

export function clearAllDirty(): void {
  safeWriteLS(DIRTY_MODULES_KEY, {});
  // Reset modified-times too — otherwise the map grows unbounded
  // across every module ever dirtied on this device and keeps stale
  // snapshots that `pushDirty`'s mid-flight change check would read.
  safeWriteLS(MODULE_MODIFIED_KEY, {});
  emitStatusEvent();
}
