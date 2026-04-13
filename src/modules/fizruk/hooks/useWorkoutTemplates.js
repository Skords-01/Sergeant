import { useCallback, useEffect, useMemo, useState } from "react";

const KEY = "fizruk_workout_templates_v1";

function uid() {
  return `tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function safeParse(raw, fallback) {
  try {
    const v = JSON.parse(raw);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

export function useWorkoutTemplates() {
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      const parsed = raw ? safeParse(raw, []) : [];
      if (Array.isArray(parsed)) setTemplates(parsed);
    } catch {}
  }, []);

  const persist = useCallback((next) => {
    setTemplates(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
  }, []);

  const addTemplate = useCallback(
    (name, exerciseIds) => {
      const n = (name || "").trim();
      if (!n) throw new Error("name required");
      const ids = Array.isArray(exerciseIds) ? exerciseIds.filter(Boolean) : [];
      const t = {
        id: uid(),
        name: n,
        exerciseIds: ids,
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

  const sorted = useMemo(
    () =>
      [...templates].sort((a, b) =>
        (b.updatedAt || "").localeCompare(a.updatedAt || ""),
      ),
    [templates],
  );

  return { templates: sorted, addTemplate, updateTemplate, removeTemplate };
}
