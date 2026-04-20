import { toLocalISODate } from "./nutritionStorage.js";

export function fmtMacro(n: unknown): number | "—" {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return Math.round(Number(n));
}

export function todayISODate(): string {
  return toLocalISODate(new Date());
}
