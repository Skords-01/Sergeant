/** Стабільне сортування звичок за збереженим порядком */

import type { Habit } from "./types";

export function sortHabitsByOrder<T extends Habit = Habit>(
  habits: T[],
  order: string[] | null | undefined,
): T[] {
  const idx = new Map<string, number>(
    (order || []).map((id, i) => [id, i] as const),
  );
  return [...habits].sort((a, b) => {
    const ia = idx.has(a.id) ? (idx.get(a.id) as number) : 99999;
    const ib = idx.has(b.id) ? (idx.get(b.id) as number) : 99999;
    if (ia !== ib) return ia - ib;
    return (a.name || "").localeCompare(b.name || "", "uk");
  });
}
