/**
 * Thin web adapter over `@sergeant/shared/lib/vibePicks`. The shared
 * module owns key constants, sanitization and normalization rules;
 * this file just binds them to a `window.localStorage`-backed
 * `KVStore` so existing call-sites (OnboardingWizard, HubDashboard,
 * FirstActionSheet, analytics, …) keep the exact same API they had
 * before the mobile port.
 */

import {
  type DashboardModuleId,
  type KVStore,
  ALL_MODULES as SHARED_ALL_MODULES,
  dismissSoftAuth as sharedDismissSoftAuth,
  clearFirstActionPending as sharedClearFirstActionPending,
  getFirstActionStartedAt as sharedGetFirstActionStartedAt,
  getSessionDays as sharedGetSessionDays,
  getTimeToValueMs as sharedGetTimeToValueMs,
  getVibePicks as sharedGetVibePicks,
  isFirstActionPending as sharedIsFirstActionPending,
  isFirstRealEntryDone as sharedIsFirstRealEntryDone,
  isSoftAuthDismissed as sharedIsSoftAuthDismissed,
  markFirstActionPending as sharedMarkFirstActionPending,
  markFirstActionStartedAt as sharedMarkFirstActionStartedAt,
  markFirstRealEntryDone as sharedMarkFirstRealEntryDone,
  recordSessionDay as sharedRecordSessionDay,
  saveTimeToValueMs as sharedSaveTimeToValueMs,
  saveVibePicks as sharedSaveVibePicks,
} from "@sergeant/shared";

export type HubModuleId = DashboardModuleId;

export const ALL_MODULES: HubModuleId[] = [...SHARED_ALL_MODULES];

const localStorageStore: KVStore = {
  getString(key) {
    try {
      return typeof localStorage !== "undefined"
        ? localStorage.getItem(key)
        : null;
    } catch {
      return null;
    }
  },
  setString(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* noop */
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* noop */
    }
  },
};

export function getVibePicks(): HubModuleId[] {
  return sharedGetVibePicks(localStorageStore);
}

export function saveVibePicks(picks: HubModuleId[]): void {
  sharedSaveVibePicks(localStorageStore, picks);
}

export function markFirstActionPending(): void {
  sharedMarkFirstActionPending(localStorageStore);
}

export function clearFirstActionPending(): void {
  sharedClearFirstActionPending(localStorageStore);
}

export function isFirstActionPending(): boolean {
  return sharedIsFirstActionPending(localStorageStore);
}

export function markFirstRealEntryDone(): void {
  sharedMarkFirstRealEntryDone(localStorageStore);
}

export function isFirstRealEntryDone(): boolean {
  return sharedIsFirstRealEntryDone(localStorageStore);
}

export function isSoftAuthDismissed(): boolean {
  return sharedIsSoftAuthDismissed(localStorageStore);
}

export function dismissSoftAuth(): void {
  sharedDismissSoftAuth(localStorageStore);
}

export function markFirstActionStartedAt(): void {
  sharedMarkFirstActionStartedAt(localStorageStore);
}

export function getFirstActionStartedAt(): number | null {
  return sharedGetFirstActionStartedAt(localStorageStore);
}

export function saveTimeToValueMs(ms: number): void {
  sharedSaveTimeToValueMs(localStorageStore, ms);
}

export function getTimeToValueMs(): number | null {
  return sharedGetTimeToValueMs(localStorageStore);
}

export function recordSessionDay(): number {
  return sharedRecordSessionDay(localStorageStore);
}

export function getSessionDays(): number {
  return sharedGetSessionDays(localStorageStore);
}
