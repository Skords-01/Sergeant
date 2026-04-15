function toFiniteNumberOrNull(x) {
  if (x == null || x === "") return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function nonNegOrNull(n) {
  if (n == null) return null;
  return n >= 0 ? n : null;
}

export function normalizeMacrosNullable(mac) {
  const obj =
    mac && typeof mac === "object" && !Array.isArray(mac) ? mac : null;
  return {
    kcal: nonNegOrNull(toFiniteNumberOrNull(obj?.kcal)),
    protein_g: nonNegOrNull(toFiniteNumberOrNull(obj?.protein_g)),
    fat_g: nonNegOrNull(toFiniteNumberOrNull(obj?.fat_g)),
    carbs_g: nonNegOrNull(toFiniteNumberOrNull(obj?.carbs_g)),
  };
}

export function macrosToTotals(mac) {
  const m = normalizeMacrosNullable(mac);
  return {
    kcal: m.kcal ?? 0,
    protein_g: m.protein_g ?? 0,
    fat_g: m.fat_g ?? 0,
    carbs_g: m.carbs_g ?? 0,
  };
}

export function macrosHasAnyValue(mac) {
  const m = normalizeMacrosNullable(mac);
  return (
    m.kcal != null || m.protein_g != null || m.fat_g != null || m.carbs_g != null
  );
}

