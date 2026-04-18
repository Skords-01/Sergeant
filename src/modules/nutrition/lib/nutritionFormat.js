import { toLocalISODate } from "./nutritionStorage.js";

export function fmtMacro(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return Math.round(Number(n));
}

export function todayISODate() {
  return toLocalISODate(new Date());
}
