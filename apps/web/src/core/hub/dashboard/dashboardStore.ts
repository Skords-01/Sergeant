import {
  safeReadLS,
  safeReadStringLS,
  safeRemoveLS,
  safeWriteLS,
} from "@shared/lib/storage";
import {
  STORAGE_KEYS,
  normalizeDashboardOrder,
  type KVStore,
} from "@sergeant/shared";

/**
 * `KVStore` adapter backed by `window.localStorage`. Used by shared
 * onboarding/engagement helpers (`countRealEntries`, `getActiveNudge`,
 * `recordLastActiveDate`, `shouldShowReengagement`) that are agnostic to
 * the storage backend (web LS vs. mobile MMKV).
 *
 * Goes through `safeReadStringLS` / `safeWriteLS` / `safeRemoveLS` so the
 * adapter inherits the same private-browsing / quota-exceeded handling
 * as the rest of the app and stays compliant with `no-raw-local-storage`.
 */
export const localStorageStore: KVStore = {
  getString: (k) => safeReadStringLS(k, null),
  setString: (k, v) => {
    safeWriteLS(k, v);
  },
  remove: (k) => {
    safeRemoveLS(k);
  },
};

const DASHBOARD_ORDER_KEY = STORAGE_KEYS.DASHBOARD_ORDER;

export function loadDashboardOrder() {
  return normalizeDashboardOrder(safeReadLS(DASHBOARD_ORDER_KEY, null));
}

export function saveDashboardOrder(order: string[]) {
  safeWriteLS(DASHBOARD_ORDER_KEY, order);
}

export function resetDashboardOrder() {
  safeRemoveLS(DASHBOARD_ORDER_KEY);
}
