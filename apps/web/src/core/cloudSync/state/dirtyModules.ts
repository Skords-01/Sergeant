import { safeReadLS, safeWriteLS } from "@shared/lib/storage";
import { DIRTY_MODULES_KEY, MODULE_MODIFIED_KEY } from "../config";
import { emitStatusEvent } from "./events";

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
  // Reset the modified-times map too. Otherwise it grows unbounded across
  // every module that was ever dirtied on this device, wasting localStorage
  // and keeping stale snapshots for `pushDirty`'s mid-flight change check.
  safeWriteLS(MODULE_MODIFIED_KEY, {});
  emitStatusEvent();
}
