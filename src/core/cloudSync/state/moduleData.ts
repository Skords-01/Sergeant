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
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        try {
          data[key] = JSON.parse(raw);
        } catch {
          data[key] = raw;
        }
      }
    } catch {
      /* swallow storage access errors */
    }
  }
  return data;
}

export function hasLocalData(moduleName: string): boolean {
  const config = SYNC_MODULES[moduleName as ModuleName];
  if (!config) return false;
  for (const key of config.keys) {
    try {
      if (localStorage.getItem(key) !== null) return true;
    } catch {
      /* swallow */
    }
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
      try {
        const val = obj[key];
        localStorage.setItem(
          key,
          typeof val === "string" ? val : JSON.stringify(val),
        );
      } catch {
        /* swallow */
      }
    }
  }
}

/**
 * Wipe sync-managed keys using the raw (un-patched) `removeItem`, so we don't
 * re-mark modules dirty while clearing a previous user's data.
 */
export function clearSyncManagedData(
  rawRemoveItem: (key: string) => void,
): void {
  for (const config of Object.values(SYNC_MODULES)) {
    for (const key of config.keys) {
      try {
        rawRemoveItem(key);
      } catch {
        /* swallow */
      }
    }
  }
  try {
    localStorage.removeItem(DIRTY_MODULES_KEY);
    localStorage.removeItem(OFFLINE_QUEUE_KEY);
    localStorage.removeItem(MODULE_MODIFIED_KEY);
  } catch {
    /* swallow */
  }
}
