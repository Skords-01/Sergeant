import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CUSTOM_EXERCISES_KEY,
  parseCustomExercisesFromStorage,
  serializeCustomExercisesToStorage,
} from "../lib/fizrukStorage";

function norm(s) {
  return (s || "").toString().trim().toLowerCase();
}

export function useExerciseCatalog() {
  const [catalogData, setCatalogData] = useState(null);
  const [customExercises, setCustomExercises] = useState([]);

  useEffect(() => {
    let cancelled = false;
    import("../data/exercises.gymup.json")
      .then((m) => {
        if (!cancelled) setCatalogData(m.default || m);
      })
      .catch(() => {
        if (!cancelled) setCatalogData({ exercises: [], labels: {} });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const primaryGroupsUk = catalogData?.labels?.primaryGroupsUk || {};
  const musclesUk = catalogData?.labels?.musclesUk || {};
  const musclesByPrimaryGroup =
    catalogData?.labels?.musclesByPrimaryGroup || {};

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_EXERCISES_KEY);
      const parsed = parseCustomExercisesFromStorage(raw);
      if (Array.isArray(parsed)) setCustomExercises(parsed);
    } catch {}
  }, []);

  const persistCustom = useCallback((next) => {
    setCustomExercises(next);
    try {
      localStorage.setItem(
        CUSTOM_EXERCISES_KEY,
        serializeCustomExercisesToStorage(next),
      );
    } catch {}
  }, []);

  const exercises = useMemo(() => {
    const baseExercises = catalogData?.exercises || [];
    const merged = [...customExercises, ...baseExercises];
    const seen = new Set();
    return merged.filter((ex) => {
      const id = ex?.id;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [customExercises, catalogData]);

  const search = useCallback(
    (query) => {
      const q = norm(query);
      if (!q) return exercises;

      return exercises.filter((ex) => {
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
    },
    [exercises],
  );

  const addExercise = useCallback(
    (ex) => {
      if (!ex?.id) throw new Error("id is required");
      if (!ex?.name?.uk) throw new Error("name.uk is required");
      const next = [
        { ...ex, _custom: true },
        ...customExercises.filter((x) => x?.id !== ex.id),
      ];
      persistCustom(next);
    },
    [customExercises, persistCustom],
  );

  const removeExercise = useCallback(
    (id) => {
      if (!id) return false;
      const next = customExercises.filter((x) => x?.id !== id);
      if (next.length === customExercises.length) return false;
      persistCustom(next);
      return true;
    },
    [customExercises, persistCustom],
  );

  const catalog = catalogData || { exercises: [], labels: {} };

  return {
    catalog,
    exercises,
    search,
    primaryGroupsUk,
    musclesUk,
    musclesByPrimaryGroup,
    addExercise,
    removeExercise,
    customExercises,
    catalogLoading: !catalogData,
  };
}
