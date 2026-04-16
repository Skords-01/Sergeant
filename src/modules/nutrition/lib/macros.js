/**
 * @typedef {{ kcal: number|null, protein_g: number|null, fat_g: number|null, carbs_g: number|null }} NullableMacros
 * Macros object where each field may be null (unknown / not entered).
 */

/**
 * @typedef {{ kcal: number, protein_g: number, fat_g: number, carbs_g: number }} Macros
 * Macros object with numeric totals (null coerced to 0).
 */

/**
 * Convert an arbitrary value to a finite number or null.
 * @param {unknown} x
 * @returns {number|null}
 */
function toFiniteNumberOrNull(x) {
  if (x == null || x === "") return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

/**
 * Return the number unchanged if non-negative, otherwise null.
 * @param {number|null} n
 * @returns {number|null}
 */
function nonNegOrNull(n) {
  if (n == null) return null;
  return n >= 0 ? n : null;
}

/**
 * Normalize a macros value to a `NullableMacros` object.
 * Accepts any shape; invalid / negative / non-finite values become null.
 * @param {unknown} mac - Raw macros value (any shape accepted).
 * @returns {NullableMacros}
 */
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

/**
 * Convert a nullable macros value to totals with 0 as the fallback for null fields.
 * Use this for arithmetic (summing meals, computing averages, etc.).
 * @param {unknown} mac
 * @returns {Macros}
 */
export function macrosToTotals(mac) {
  const m = normalizeMacrosNullable(mac);
  return {
    kcal: m.kcal ?? 0,
    protein_g: m.protein_g ?? 0,
    fat_g: m.fat_g ?? 0,
    carbs_g: m.carbs_g ?? 0,
  };
}

/**
 * Return `true` if at least one macro field has a non-null numeric value.
 * Use to distinguish "user entered some data" from "completely empty".
 * @param {unknown} mac
 * @returns {boolean}
 */
export function macrosHasAnyValue(mac) {
  const m = normalizeMacrosNullable(mac);
  return (
    m.kcal != null || m.protein_g != null || m.fat_g != null || m.carbs_g != null
  );
}
