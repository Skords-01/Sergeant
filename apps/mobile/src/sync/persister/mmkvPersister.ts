/**
 * React Query persister backed by MMKV.
 *
 * `@tanstack/query-sync-storage-persister` expects a storage object
 * with `getItem`/`setItem`/`removeItem` methods that return strings
 * synchronously. MMKV fits perfectly: all I/O is synchronous in-process
 * and values are flat strings, so the warm-start path is fast (no
 * `await` on every query rehydrate) and avoids the serialization
 * costs of the AsyncStorage-backed persister.
 *
 * We expose two entry points:
 *   - `createMMKVPersister()` — ready-to-pass `persister` option for
 *     `PersistQueryClientProvider`.
 *   - `mmkvSyncStorage`       — raw storage adapter, re-usable for
 *     other persisted stores in the future (e.g. a Jotai store).
 */
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

import {
  _getMMKVInstance,
  safeReadStringLS,
  safeRemoveLS,
  safeWriteLS,
} from "@/lib/storage";
import { QUERY_CACHE_KEY } from "../config";

export const mmkvSyncStorage = {
  getItem: (key: string): string | null => safeReadStringLS(key),
  setItem: (key: string, value: string): void => {
    safeWriteLS(key, value);
  },
  removeItem: (key: string): void => {
    safeRemoveLS(key);
  },
};

export function createMMKVPersister() {
  return createSyncStoragePersister({
    storage: mmkvSyncStorage,
    key: QUERY_CACHE_KEY,
    // Throttle disk writes so a burst of query updates doesn't spam
    // MMKV. 1s matches TanStack's own default.
    throttleTime: 1000,
  });
}

// Re-export to make it easy for tests / debug screens to poke at the
// underlying MMKV instance without reaching into `@/lib/storage`.
export { _getMMKVInstance };
