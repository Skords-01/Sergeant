import { useCallback, useEffect, useMemo, useState } from "react";
import { safeReadLS, safeWriteLS } from "@shared/lib/storage.js";
import { STORAGE_KEYS } from "@shared/lib/storageKeys.js";

const KEY = STORAGE_KEYS.FIZRUK_TEMPLATES;

function uid() {
  return `tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useWorkoutTemplates() {
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    const parsed = safeReadLS(KEY, []);
    if (Array.isArray(parsed)) setTemplates(parsed);
  }, []);

  const persist = useCallback((next) => {
    setTemplates(next);
    safeWriteLS(KEY, next);
  }, []);

  const addTemplate = useCallback(
    (name, exerciseIds, { groups } = {}) => {
      const n = (name || "").trim();
      if (!n) throw new Error("name required");
      const ids = Array.isArray(exerciseIds) ? exerciseIds.filter(Boolean) : [];
      const t = {
        id: uid(),
        name: n,
        exerciseIds: ids,
        groups: Array.isArray(groups) ? groups : [],
        updatedAt: new Date().toISOString(),
      };
      persist([t, ...templates]);
      return t;
    },
    [persist, templates],
  );

  const updateTemplate = useCallback(
    (id, patch) => {
      persist(
        templates.map((t) =>
          t.id === id
            ? { ...t, ...patch, updatedAt: new Date().toISOString() }
            : t,
        ),
      );
    },
    [persist, templates],
  );

  const removeTemplate = useCallback(
    (id) => {
      persist(templates.filter((t) => t.id !== id));
    },
    [persist, templates],
  );

  const markTemplateUsed = useCallback(
    (id) => {
      persist(
        templates.map((t) =>
          t.id === id ? { ...t, lastUsedAt: new Date().toISOString() } : t,
        ),
      );
    },
    [persist, templates],
  );

  const sorted = useMemo(
    () =>
      [...templates].sort((a, b) =>
        (b.updatedAt || "").localeCompare(a.updatedAt || ""),
      ),
    [templates],
  );

  const recentlyUsed = useMemo(
    () =>
      [...templates]
        .filter((t) => t.lastUsedAt)
        .sort((a, b) => (b.lastUsedAt || "").localeCompare(a.lastUsedAt || ""))
        .slice(0, 3),
    [templates],
  );

  return {
    templates: sorted,
    recentlyUsed,
    addTemplate,
    updateTemplate,
    removeTemplate,
    markTemplateUsed,
  };
}
