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
export function safeReadLS(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined) return fallback;
    try {
      const parsed = JSON.parse(raw);
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
export function safeReadStringLS(key, fallback = null) {
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
export function safeWriteLS(key, value) {
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
export function safeRemoveLS(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * React hook backed by localStorage. Stores JSON-serialized values.
 *
 * - Reads the initial value synchronously so there is no flash of fallback.
 * - Listens to the cross-tab `storage` event.
 * - Supports the `(prev) => next` updater signature, like `useState`.
 */
export function useLocalStorage(key, fallback) {
  const fallbackRef = useRef(fallback);
  fallbackRef.current = fallback;

  const [value, setValue] = useState(() => safeReadLS(key, fallback));

  useEffect(() => {
    setValue(safeReadLS(key, fallbackRef.current));
  }, [key]);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== key) return;
      setValue(safeReadLS(key, fallbackRef.current));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);

  const update = useCallback(
    (next) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        safeWriteLS(key, resolved);
        return resolved;
      });
    },
    [key],
  );

  const remove = useCallback(() => {
    safeRemoveLS(key);
    setValue(fallbackRef.current);
  }, [key]);

  return [value, update, remove];
}
