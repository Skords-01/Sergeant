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

  // Функціональний updater через setTemplates, щоб уникнути stale closure:
  // колбеки в undo-toast можуть викликатись після того, як state оновився
  // (див. AGENTS.md §5.11).
  const persist = useCallback((updater) => {
    setTemplates((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      safeWriteLS(KEY, next);
      return next;
    });
  }, []);

  const addTemplate = useCallback(
    (
      name: string,
      exerciseIds: string[],
      { groups }: { groups?: unknown[] } = {},
    ) => {
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
      persist((prev) => [t, ...prev]);
      return t;
    },
    [persist],
  );

  const updateTemplate = useCallback(
    (id, patch) => {
      persist((prev) =>
        prev.map((t) =>
          t.id === id
            ? { ...t, ...patch, updatedAt: new Date().toISOString() }
            : t,
        ),
      );
    },
    [persist],
  );

  const removeTemplate = useCallback(
    (id) => {
      persist((prev) => prev.filter((t) => t.id !== id));
    },
    [persist],
  );

  const restoreTemplate = useCallback(
    (template, atIndex) => {
      if (!template || !template.id) return;
      persist((prev) => {
        if (prev.some((t) => t.id === template.id)) return prev;
        const next = [...prev];
        const idx =
          typeof atIndex === "number" && atIndex >= 0
            ? Math.min(atIndex, next.length)
            : next.length;
        next.splice(idx, 0, template);
        return next;
      });
    },
    [persist],
  );

  const markTemplateUsed = useCallback(
    (id) => {
      persist((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, lastUsedAt: new Date().toISOString() } : t,
        ),
      );
    },
    [persist],
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
    restoreTemplate,
    markTemplateUsed,
  };
}
