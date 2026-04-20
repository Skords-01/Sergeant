import { useEffect, useState } from "react";
import { STORAGE_KEYS } from "@shared/lib/storageKeys.js";

const HUB_PREFS_KEY = STORAGE_KEYS.HUB_PREFS;

type HubPrefs = Record<string, unknown>;

function loadHubPrefs(): HubPrefs {
  try {
    const raw = localStorage.getItem(HUB_PREFS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as HubPrefs) : {};
  } catch {
    return {};
  }
}

function saveHubPref(key: string, value: unknown): void {
  try {
    const prefs = loadHubPrefs();
    localStorage.setItem(
      HUB_PREFS_KEY,
      JSON.stringify({ ...prefs, [key]: value }),
    );
    window.dispatchEvent(new StorageEvent("storage", { key: HUB_PREFS_KEY }));
  } catch {
    /* quota or serialization — safe to ignore */
  }
}

/**
 * Reactive single-pref hook that stays in sync with cross-tab `storage`
 * events and the same-tab StorageEvent dispatched by `saveHubPref`.
 */
export function useHubPref<T>(
  key: string,
  defaultValue: T,
): [T, (next: T) => void] {
  const read = (): T => {
    const prefs = loadHubPrefs();
    return key in prefs ? (prefs[key] as T) : defaultValue;
  };
  const [value, setValue] = useState<T>(read);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === HUB_PREFS_KEY || e.key === null) setValue(read());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = (next: T) => {
    setValue(next);
    saveHubPref(key, next);
  };

  return [value, update];
}
