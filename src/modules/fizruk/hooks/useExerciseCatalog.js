import { useCallback, useEffect, useMemo, useState } from "react";
import catalog from "../data/exercises.gymup.json";

const CUSTOM_KEY = "fizruk_custom_exercises_v1";

function norm(s) {
  return (s || "")
    .toString()
    .trim()
    .toLowerCase();
}

export function useExerciseCatalog() {
  const baseExercises = catalog.exercises || [];
  const primaryGroupsUk = catalog.labels?.primaryGroupsUk || {};
  const [customExercises, setCustomExercises] = useState([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setCustomExercises(parsed);
    } catch {}
  }, []);

  const persistCustom = useCallback((next) => {
    setCustomExercises(next);
    try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(next)); } catch {}
  }, []);

  const exercises = useMemo(() => {
    const merged = [...customExercises, ...baseExercises];
    const seen = new Set();
    return merged.filter(ex => {
      const id = ex?.id;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [customExercises, baseExercises]);

  const search = (query) => {
    const q = norm(query);
    if (!q) return exercises;

    return exercises.filter(ex => {
      const nameUk = norm(ex?.name?.uk);
      const nameEn = norm(ex?.name?.en);
      const aliases = (ex?.aliases || []).map(norm).join(" ");
      const desc = norm(ex?.description);
      const group = norm(ex?.primaryGroup);
      const groupUk = norm(ex?.primaryGroupUk);
      return (
        nameUk.includes(q) ||
        nameEn.includes(q) ||
        aliases.includes(q) ||
        desc.includes(q) ||
        group.includes(q) ||
        groupUk.includes(q)
      );
    });
  };

  const addExercise = useCallback((ex) => {
    if (!ex?.id) throw new Error("id is required");
    if (!ex?.name?.uk) throw new Error("name.uk is required");
    const next = [{ ...ex, _custom: true }, ...customExercises.filter(x => x?.id !== ex.id)];
    persistCustom(next);
  }, [customExercises, persistCustom]);

  return { catalog, exercises, search, primaryGroupsUk, addExercise, customExercises };
}

