/**
 * ColorSchemeBridge — keeps NativeWind's runtime `colorScheme` in sync
 * with the user's "Темна тема" preference (persisted in MMKV under the
 * shared `STORAGE_KEYS.HUB_PREFS` slice).
 *
 * Mounted once near the root of the app (see `apps/mobile/app/_layout.tsx`).
 * Subscribes to MMKV writes through `useLocalStorage`, so a toggle from
 * `GeneralSection` (or a future cloud-sync pull) re-tints semantic-token
 * surfaces without remounting the tree.
 *
 * Tri-state mapping mirrors the web `useHubPref("dark")` semantics:
 *
 *   prefs.darkMode === true   → "dark"
 *   prefs.darkMode === false  → "light"
 *   prefs.darkMode missing    → "system" (follow OS scheme)
 *
 * Required Tailwind config: `darkMode: "class"` in
 * `apps/mobile/tailwind.config.js` so NativeWind honours imperative
 * `colorScheme.set()` calls instead of locking on `Appearance` alone.
 */
import { useEffect } from "react";
import { colorScheme } from "nativewind";
import { STORAGE_KEYS } from "@sergeant/shared";

import { useLocalStorage } from "@/lib/storage";

interface HubPrefs {
  darkMode?: boolean;
}

type Scheme = "dark" | "light" | "system";

function resolveScheme(prefs: HubPrefs): Scheme {
  if (prefs.darkMode === true) return "dark";
  if (prefs.darkMode === false) return "light";
  return "system";
}

export function ColorSchemeBridge(): null {
  const [prefs] = useLocalStorage<HubPrefs>(STORAGE_KEYS.HUB_PREFS, {});

  useEffect(() => {
    colorScheme.set(resolveScheme(prefs));
    // Only the tri-state pref drives the colour scheme — other HubPrefs
    // fields (`showCoach`, `showHints`, …) must not retrigger a setter
    // that NativeWind treats as a fresh `colorScheme.set` event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.darkMode]);

  return null;
}
