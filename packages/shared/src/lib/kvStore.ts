/**
 * Minimal DOM-free key/value store contract.
 *
 * Pure helpers in `@sergeant/shared/lib/*` that need to read or write
 * persisted flags take an instance of this interface instead of
 * reaching into `localStorage` / `MMKV` directly. Platform adapters
 * provide the concrete implementation:
 *
 *  - web: `apps/web/src/core/onboarding/*` wraps `window.localStorage`;
 *  - mobile: `apps/mobile/src/lib/storage.ts` wraps the shared MMKV
 *    instance.
 *
 * All methods must be safe — implementations are expected to swallow
 * errors (quota exceeded, storage disabled, JSON parse) and return
 * `null` / no-op rather than throwing. Helpers assume they can call
 * these methods freely without try/catch.
 */
export interface KVStore {
  /** Read the raw string stored under `key`. Returns `null` if missing. */
  getString(key: string): string | null;
  /** Overwrite the string value under `key`. */
  setString(key: string, value: string): void;
  /** Delete the value under `key`. No-op if missing. */
  remove(key: string): void;
}

/**
 * In-memory KV store suitable for vitest/jest suites. Not thread-safe;
 * callers are expected to scope a fresh instance per test.
 */
export function createMemoryKVStore(
  initial: Record<string, string> = {},
): KVStore {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getString(key) {
      return map.has(key) ? (map.get(key) as string) : null;
    },
    setString(key, value) {
      map.set(key, value);
    },
    remove(key) {
      map.delete(key);
    },
  };
}

/**
 * Convenience: parse a JSON string from `store` under `key`. Returns
 * `null` when the slot is missing or the payload cannot be parsed.
 */
export function readJSON<T = unknown>(store: KVStore, key: string): T | null {
  const raw = store.getString(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Convenience: serialize `value` to JSON and write it under `key`.
 * Silently no-ops when serialization fails (e.g. cyclic references).
 */
export function writeJSON(store: KVStore, key: string, value: unknown): void {
  try {
    store.setString(key, JSON.stringify(value));
  } catch {
    /* noop */
  }
}
