/**
 * Finyk backup — web storage adapter.
 *
 * The pure normalize / version / payload-shape logic lives in
 * `@sergeant/finyk-domain/backup` so the mobile app can reuse it
 * without depending on localStorage. This module layers the web
 * `readJSON` / `writeJSON` storage adapter on top to produce the
 * import/export workflows FinykApp already expects.
 *
 * Re-exports the pure helpers + types under the same names so existing
 * call sites that import from `./lib/finykBackup` keep working; new
 * code (especially mobile) should import directly from
 * `@sergeant/finyk-domain/backup`.
 */

import { DEFAULT_SUBSCRIPTIONS } from "../constants";
import { notifyFinykRoutineCalendarSync } from "../hubRoutineSync";
import { readJSON, writeJSON } from "./finykStorage";
import {
  DEFAULT_FINYK_MONTHLY_PLAN,
  FINYK_BACKUP_VERSION,
  FINYK_FIELD_TO_STORAGE_KEY,
  normalizeFinykBackup,
  normalizeFinykSyncPayload,
  type FinykBackup,
} from "@sergeant/finyk-domain/backup";

// Re-export pure helpers under their existing names so `apps/web`
// call sites that still import `FINYK_BACKUP_VERSION`, the `FinykBackup`
// type, `normalizeFinykBackup`, `normalizeFinykSyncPayload` from
// `./lib/finykBackup` keep compiling without churn.
export {
  FINYK_BACKUP_VERSION,
  normalizeFinykBackup,
  normalizeFinykSyncPayload,
};
export type { FinykBackup };

function readJsonFromLocalStorage<T>(key: string, fallback: T): T {
  return readJSON(key, fallback) as T;
}

/**
 * Знімок даних Фініка з localStorage (без React), той самий зміст що й exportData.
 */
export function readFinykBackupFromStorage() {
  return {
    version: FINYK_BACKUP_VERSION,
    budgets: readJsonFromLocalStorage(
      FINYK_FIELD_TO_STORAGE_KEY.budgets,
      [] as unknown[],
    ),
    subscriptions: readJsonFromLocalStorage(
      FINYK_FIELD_TO_STORAGE_KEY.subscriptions,
      DEFAULT_SUBSCRIPTIONS as unknown[],
    ),
    manualAssets: readJsonFromLocalStorage(
      FINYK_FIELD_TO_STORAGE_KEY.manualAssets,
      [] as unknown[],
    ),
    manualDebts: readJsonFromLocalStorage(
      FINYK_FIELD_TO_STORAGE_KEY.manualDebts,
      [] as unknown[],
    ),
    receivables: readJsonFromLocalStorage(
      FINYK_FIELD_TO_STORAGE_KEY.receivables,
      [] as unknown[],
    ),
    hiddenAccounts: readJsonFromLocalStorage(
      FINYK_FIELD_TO_STORAGE_KEY.hiddenAccounts,
      [] as unknown[],
    ),
    hiddenTxIds: readJsonFromLocalStorage(
      FINYK_FIELD_TO_STORAGE_KEY.hiddenTxIds,
      [] as unknown[],
    ),
    monthlyPlan: readJsonFromLocalStorage(
      FINYK_FIELD_TO_STORAGE_KEY.monthlyPlan,
      { ...DEFAULT_FINYK_MONTHLY_PLAN } as Record<string, unknown>,
    ),
    txCategories: readJsonFromLocalStorage(
      FINYK_FIELD_TO_STORAGE_KEY.txCategories,
      {} as Record<string, unknown>,
    ),
    txSplits: readJsonFromLocalStorage(
      FINYK_FIELD_TO_STORAGE_KEY.txSplits,
      {} as Record<string, unknown>,
    ),
    monoDebtLinkedTxIds: readJsonFromLocalStorage(
      FINYK_FIELD_TO_STORAGE_KEY.monoDebtLinkedTxIds,
      {} as Record<string, unknown>,
    ),
    networthHistory: readJsonFromLocalStorage(
      FINYK_FIELD_TO_STORAGE_KEY.networthHistory,
      [] as unknown[],
    ),
    customCategories: readJsonFromLocalStorage(
      FINYK_FIELD_TO_STORAGE_KEY.customCategories,
      [] as unknown[],
    ),
    dismissedRecurring: readJsonFromLocalStorage(
      FINYK_FIELD_TO_STORAGE_KEY.dismissedRecurring,
      [] as unknown[],
    ),
  };
}

/**
 * Записує нормалізований бекап Фініка в localStorage (після normalizeFinykBackup).
 */
export function persistFinykNormalizedToStorage(normalized: FinykBackup): void {
  for (const [field, storageKey] of Object.entries(
    FINYK_FIELD_TO_STORAGE_KEY,
  )) {
    const value = (normalized as Record<string, unknown>)[field];
    if (value !== undefined) {
      writeJSON(storageKey, value);
    }
  }
  notifyFinykRoutineCalendarSync();
}
