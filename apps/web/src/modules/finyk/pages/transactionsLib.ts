import { STORAGE_KEYS } from "@sergeant/shared";
import { safeReadLS, safeWriteLS } from "@shared/lib/storage";

export const DAY_COLLAPSE_KEY = STORAGE_KEYS.FINYK_TX_DAY_COLLAPSE;

export type DayCollapseOverrides = Record<string, boolean>;

/**
 * Build a `YYYY-MM-DD` key from a Mono UNIX-seconds timestamp.
 * Used to bucket transactions into days for the GroupedVirtuoso list.
 */
export function dayKeyFromTx(ts: number): string {
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Read persisted day-expand overrides. Returns an empty object on
 * missing / corrupt JSON / private-mode storage so the UI defaults
 * to "all collapsed".
 */
export function readDayCollapse(): DayCollapseOverrides {
  const parsed = safeReadLS<unknown>(DAY_COLLAPSE_KEY, null);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed as DayCollapseOverrides;
  }
  return {};
}

/**
 * Persist day-expand overrides. Drop silently on quota / private-mode
 * failures — losing the preference is preferable to throwing.
 */
export function writeDayCollapse(v: DayCollapseOverrides): void {
  safeWriteLS(DAY_COLLAPSE_KEY, v);
}

/**
 * Days are collapsed by default; the user explicitly toggles them
 * open via the sticky day-header. The third arg `_todayKey` is kept
 * in the signature on purpose: a feature-toggle could re-introduce
 * "today is always expanded" behaviour without changing call-sites.
 */
export function isDayExpanded(
  overrides: DayCollapseOverrides,
  key: string,
  _todayKey: string,
): boolean {
  return !!overrides[key];
}

/**
 * Localised day label rendered inside the sticky header.
 * Today / Yesterday get word labels; everything else falls back to
 * the long Ukrainian weekday + day-of-month.
 */
export function formatStickyDayLabel(key: string): string {
  const [y, m, da] = key.split("-").map(Number);
  const d = new Date(y, m - 1, da);
  const t0 = new Date();
  t0.setHours(0, 0, 0, 0);
  const d0 = new Date(d);
  d0.setHours(0, 0, 0, 0);
  const diffDays = Math.round((t0.getTime() - d0.getTime()) / 86400000);
  if (diffDays === 0) return "Сьогодні";
  if (diffDays === 1) return "Вчора";
  return d.toLocaleDateString("uk-UA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
