/**
 * `useSyncedStorage` — `useLocalStorage` + automatic cloud-sync wiring.
 *
 * Why this exists
 * ---------------
 * MMKV writes go straight to native, so unlike web (where we patch
 * `localStorage.setItem` once and forget about it — see
 * `apps/web/src/core/cloudSync/storagePatch.ts`), every mobile hook
 * that persists a tracked sync key must explicitly call
 * `enqueueChange(key)` after each write. The Finyk and Fizruk hooks
 * silently shipped without that call until it was caught manually,
 * and the routineStore pattern only documents the convention — it
 * does not enforce it.
 *
 * `useSyncedStorage` collapses the two-step "write + enqueue" into a
 * single hook so any future module that opts in cannot forget. It
 * preserves the exact return shape of `useLocalStorage`
 * (`[value, setValue, remove]`) so it is a drop-in replacement.
 *
 * When to reach for it
 * --------------------
 * Use `useSyncedStorage` whenever the storage key is registered in
 * `apps/mobile/src/sync/config.ts → SYNC_MODULES`. For untracked
 * MMKV state (UI-only prefs like the Routine main-tab selection or
 * experimental flags) keep using the raw `useLocalStorage` — calling
 * `enqueueChange` for an untracked key still emits the sync event
 * and would cause the scheduler to run an empty cycle.
 */
import { useCallback } from "react";

import {
  useLocalStorage,
  type UseLocalStorageRemove,
  type UseLocalStorageReturn,
  type UseLocalStorageSetter,
} from "@/lib/storage";

import { enqueueChange } from "./enqueue";

/**
 * Drop-in replacement for `useLocalStorage` that automatically calls
 * `enqueueChange(key)` after every successful write or remove. The
 * underlying MMKV write happens first (synchronously, inside the
 * `useState` updater), so by the time `enqueueChange` runs the new
 * value is already persisted and the next sync push will pick it up.
 */
export function useSyncedStorage<T>(
  key: string,
  fallback: T,
): UseLocalStorageReturn<T> {
  const [value, setValueRaw, removeRaw] = useLocalStorage<T>(key, fallback);

  const setValue: UseLocalStorageSetter<T> = useCallback(
    (next) => {
      setValueRaw(next);
      enqueueChange(key);
    },
    [key, setValueRaw],
  );

  const remove: UseLocalStorageRemove = useCallback(() => {
    removeRaw();
    enqueueChange(key);
  }, [key, removeRaw]);

  return [value, setValue, remove];
}
