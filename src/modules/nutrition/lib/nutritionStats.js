import { addDaysISODate, getDayMacros } from "./nutritionStorage.js";
import { mealTypeFromLabel } from "./mealTypes.js";

function clamp0(n) {
  const v = Number(n);
  return Number.isFinite(v) ? Math.max(0, v) : 0;
}

export function getRowsForRange(log, endIso, dayCount) {
  const rows = [];
  for (let i = dayCount - 1; i >= 0; i--) {
    const d = addDaysISODate(endIso, -i);
    const mac = getDayMacros(log, d);
    rows.push({ date: d, ...mac });
  }
  return rows;
}

export function summarizeRows(rows) {
  const out = { days: rows.length, kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0, nonEmptyDays: 0 };
  for (const r of rows) {
    const has = (Number(r.kcal) || 0) > 0 || (Number(r.protein_g) || 0) > 0 || (Number(r.fat_g) || 0) > 0 || (Number(r.carbs_g) || 0) > 0;
    if (has) out.nonEmptyDays += 1;
    out.kcal += Number(r.kcal) || 0;
    out.protein_g += Number(r.protein_g) || 0;
    out.fat_g += Number(r.fat_g) || 0;
    out.carbs_g += Number(r.carbs_g) || 0;
  }
  return out;
}

export function avgFromSummary(sum) {
  const denom = Math.max(1, Number(sum?.nonEmptyDays) || 0);
  return {
    kcal: sum.kcal / denom,
    protein_g: sum.protein_g / denom,
    fat_g: sum.fat_g / denom,
    carbs_g: sum.carbs_g / denom,
    denom,
  };
}

export function topMeals(log, endIso, dayCount, limit = 8) {
  const start = addDaysISODate(endIso, -(dayCount - 1));
  const map = new Map(); // name -> {name,count,kcal}
  for (const [date, day] of Object.entries(log || {})) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (date < start || date > endIso) continue;
    const meals = Array.isArray(day?.meals) ? day.meals : [];
    for (const m of meals) {
      const name = String(m?.name || "").trim();
      if (!name) continue;
      const cur = map.get(name) || { name, count: 0, kcal: 0 };
      cur.count += 1;
      cur.kcal += clamp0(m?.macros?.kcal);
      map.set(name, cur);
    }
  }
  return [...map.values()]
    .sort((a, b) => b.count - a.count || b.kcal - a.kcal)
    .slice(0, Math.max(1, Number(limit) || 8));
}

export function mealTypeBreakdown(log, endIso, dayCount) {
  const start = addDaysISODate(endIso, -(dayCount - 1));
  const out = {}; // type -> {count,kcal}
  for (const [date, day] of Object.entries(log || {})) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (date < start || date > endIso) continue;
    const meals = Array.isArray(day?.meals) ? day.meals : [];
    for (const m of meals) {
      const type = String(m?.mealType || "") || mealTypeFromLabel(m?.label);
      if (!out[type]) out[type] = { count: 0, kcal: 0 };
      out[type].count += 1;
      out[type].kcal += clamp0(m?.macros?.kcal);
    }
  }
  return out;
}

