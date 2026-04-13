/** Стабільне сортування звичок за збереженим порядком */

export function sortHabitsByOrder(habits, order) {
  const idx = new Map((order || []).map((id, i) => [id, i]));
  return [...habits].sort((a, b) => {
    const ia = idx.has(a.id) ? idx.get(a.id) : 99999;
    const ib = idx.has(b.id) ? idx.get(b.id) : 99999;
    if (ia !== ib) return ia - ib;
    return (a.name || "").localeCompare(b.name || "", "uk");
  });
}
