import { useCallback, useState } from "react";
import { safeReadLS, safeWriteLS } from "@shared/lib/storage.js";
import { STORAGE_KEYS } from "@shared/lib/storageKeys.js";

const KEY = STORAGE_KEYS.FIZRUK_REST_SETTINGS;

/**
 * Default rest time in seconds per exercise category.
 * compound: chest/back/legs/glutes/full_body
 * isolation: shoulders/arms/core
 * cardio: cardio
 */
export const REST_DEFAULTS = {
  compound: 90,
  isolation: 60,
  cardio: 30,
};

export const REST_CATEGORY_LABELS = {
  compound: "Базові (compound)",
  isolation: "Ізолюючі",
  cardio: "Кардіо",
};

const ISOLATION_GROUPS = ["shoulders", "arms", "core"];
const CARDIO_GROUPS = ["cardio"];

/** Classify a primaryGroup into compound/isolation/cardio. */
export function getRestCategory(primaryGroup) {
  if (!primaryGroup) return "compound";
  if (CARDIO_GROUPS.includes(primaryGroup)) return "cardio";
  if (ISOLATION_GROUPS.includes(primaryGroup)) return "isolation";
  return "compound";
}

/**
 * Hook that provides user-configurable default rest durations per exercise type.
 * Settings are stored in localStorage.
 */
export function useRestSettings() {
  const [settings, setSettings] = useState(() => {
    const parsed = safeReadLS(KEY, {});
    return {
      ...REST_DEFAULTS,
      ...(parsed && typeof parsed === "object" ? parsed : {}),
    };
  });

  const persist = useCallback((next) => {
    setSettings(next);
    safeWriteLS(KEY, next);
  }, []);

  const updateSetting = useCallback(
    (category, sec) => {
      persist({ ...settings, [category]: Number(sec) });
    },
    [settings, persist],
  );

  const getDefaultForGroup = useCallback(
    (primaryGroup) => {
      const cat = getRestCategory(primaryGroup);
      return settings[cat] ?? REST_DEFAULTS[cat];
    },
    [settings],
  );

  return { settings, updateSetting, getDefaultForGroup };
}
