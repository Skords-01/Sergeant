/**
 * Read / write / wipe the MMKV slices that make up one sync module's
 * payload. Port of
 * `apps/web/src/core/cloudSync/state/moduleData.ts`, but reading MMKV
 * via `safeReadStringLS`/`safeWriteLS`/`safeRemoveLS` instead of
 * `localStorage.*`.
 *
 * Modules port their own data in Phase 4+; until then `collectModuleData`
 * will return empty objects for modules that have never written to
 * MMKV, and `push*` engines will correctly no-op for them.
 */
import { safeReadStringLS, safeRemoveLS, safeWriteLS } from "@/lib/storage";
import {
  DIRTY_MODULES_KEY,
  MODULE_MODIFIED_KEY,
  OFFLINE_QUEUE_KEY,
  SYNC_MODULES,
  type ModuleName,
} from "../config";

export function collectModuleData(
  moduleName: string,
): Record<string, unknown> | null {
  const config = SYNC_MODULES[moduleName as ModuleName];
  if (!config) return null;
  const data: Record<string, unknown> = {};
  for (const key of config.keys) {
    const raw = safeReadStringLS(key);
    if (raw !== null) {
      try {
        data[key] = JSON.parse(raw);
      } catch {
        data[key] = raw;
      }
    }
  }
  return data;
}

export function hasLocalData(moduleName: string): boolean {
  const config = SYNC_MODULES[moduleName as ModuleName];
  if (!config) return false;
  for (const key of config.keys) {
    if (safeReadStringLS(key) !== null) return true;
  }
  return false;
}

export function applyModuleData(moduleName: string, data: unknown): void {
  if (!data || typeof data !== "object") return;
  const config = SYNC_MODULES[moduleName as ModuleName];
  if (!config) return;
  const obj = data as Record<string, unknown>;
  for (const key of config.keys) {
    if (key in obj) {
      safeWriteLS(key, obj[key]);
    }
  }
}

/**
 * Wipe every sync-managed key plus the three pieces of sync metadata
 * (dirty map, offline queue, modified-times). Used when signing out
 * so a subsequent sign-in as a different user starts clean.
 */
export function clearSyncManagedData(): void {
  for (const config of Object.values(SYNC_MODULES)) {
    for (const key of config.keys) {
      safeRemoveLS(key);
    }
  }
  safeRemoveLS(DIRTY_MODULES_KEY);
  safeRemoveLS(OFFLINE_QUEUE_KEY);
  safeRemoveLS(MODULE_MODIFIED_KEY);
}
