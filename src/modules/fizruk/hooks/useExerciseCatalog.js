import catalog from "../data/exercises.gymup.json";

function norm(s) {
  return (s || "")
    .toString()
    .trim()
    .toLowerCase();
}

export function useExerciseCatalog() {
  const exercises = catalog.exercises || [];

  const search = (query) => {
    const q = norm(query);
    if (!q) return exercises;

    return exercises.filter(ex => {
      const nameUk = norm(ex?.name?.uk);
      const nameEn = norm(ex?.name?.en);
      const aliases = (ex?.aliases || []).map(norm).join(" ");
      const desc = norm(ex?.description);
      const group = norm(ex?.primaryGroup);
      return (
        nameUk.includes(q) ||
        nameEn.includes(q) ||
        aliases.includes(q) ||
        desc.includes(q) ||
        group.includes(q)
      );
    });
  };

  return { catalog, exercises, search };
}

