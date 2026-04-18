/**
 * Safe localStorage helpers and a useLocalStorage hook.
 *
 * These helpers swallow storage errors (quota, private mode, disabled storage)
 * so callers do not need to wrap every access in try/catch. Previously eight
 * files in this repo each defined their own `safeParseLS`/`safeParse` helper;
 * this module is the single source of truth.
 */
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Read a JSON value from localStorage.
 * Returns `fallback` on missing/invalid/unavailable storage.
 */
export function safeReadLS<T = unknown>(
  key: string,
  fallback: T | null = null,
): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined) return fallback;
    try {
      const parsed = JSON.parse(raw) as T;
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  } catch {
    return fallback;
  }
}

/**
 * Read the raw string value from localStorage without JSON parsing.
 */
export function safeReadStringLS(
  key: string,
  fallback: string | null = null,
): string | null {
  try {
    const raw = localStorage.getItem(key);
    return raw === null || raw === undefined ? fallback : raw;
  } catch {
    return fallback;
  }
}

/**
 * Write a JSON-serialized value to localStorage. Returns true on success.
 */
export function safeWriteLS(key: string, value: unknown): boolean {
  try {
    const serialized =
      typeof value === "string" ? value : JSON.stringify(value);
    localStorage.setItem(key, serialized);
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove a key from localStorage. Returns true on success.
 */
export function safeRemoveLS(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export type UseLocalStorageSetter<T> = (next: T | ((prev: T) => T)) => void;
export type UseLocalStorageRemove = () => void;
export type UseLocalStorageReturn<T> = [
  T,
  UseLocalStorageSetter<T>,
  UseLocalStorageRemove,
];

/**
 * React hook backed by localStorage. Stores JSON-serialized values.
 *
 * - Reads the initial value synchronously so there is no flash of fallback.
 * - Listens to the cross-tab `storage` event.
 * - Supports the `(prev) => next` updater signature, like `useState`.
 */
export function useLocalStorage<T>(
  key: string,
  fallback: T,
): UseLocalStorageReturn<T> {
  const fallbackRef = useRef(fallback);
  fallbackRef.current = fallback;

  const [value, setValue] = useState<T>(
    () => (safeReadLS<T>(key, fallback) as T) ?? fallback,
  );

  useEffect(() => {
    setValue(
      (safeReadLS<T>(key, fallbackRef.current) as T) ?? fallbackRef.current,
    );
  }, [key]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key) return;
      setValue(
        (safeReadLS<T>(key, fallbackRef.current) as T) ?? fallbackRef.current,
      );
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);

  const update: UseLocalStorageSetter<T> = useCallback(
    (next) => {
      setValue((prev) => {
        const resolved =
          typeof next === "function" ? (next as (prev: T) => T)(prev) : next;
        safeWriteLS(key, resolved);
        return resolved;
      });
    },
    [key],
  );

  const remove: UseLocalStorageRemove = useCallback(() => {
    safeRemoveLS(key);
    setValue(fallbackRef.current);
  }, [key]);

  return [value, update, remove];
}
