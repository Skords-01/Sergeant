import { MCC_CATEGORIES, INCOME_CATEGORIES } from "../constants";

/**
 * Мінімальний тип кастомної категорії: достатньо для overlay-пошуку
 * у `resolveExpenseOverride`. Поля додаткові (`color`, `emoji`) не
 * використовуються цим резолвером — тому лишаємо open-ended.
 */
export interface CategoryLike {
  id: string;
  label: string;
  mccs?: number[];
  keywords?: string[];
  color?: string;
  emoji?: string;
}

/**
 * Широкий вхідний тип: і strict `CategoryLike[]` (мобільний), і легасі
 * `unknown[]` / `{ id: string; label?: string }[]` з `apps/web` повинні
 * прийматись без змін у web. Вузьке звуження відбувається всередині
 * функцій.
 */
type CategoryLikeInput = readonly unknown[];

function isCategoryLike(v: unknown): v is CategoryLike {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as { id?: unknown }).id === "string"
  );
}

function resolveExpenseOverride(
  overrideId: string | null | undefined,
  customCategories: CategoryLikeInput = [],
): CategoryLike | null {
  if (!overrideId) return null;
  const fromMcc = MCC_CATEGORIES.find((c: CategoryLike) => c.id === overrideId);
  if (fromMcc) return fromMcc;
  const custom = customCategories
    .filter(isCategoryLike)
    .find((c) => c.id === overrideId);
  if (custom) {
    return {
      id: custom.id,
      label: custom.label ?? "",
      mccs: [],
      keywords: [],
    };
  }
  return null;
}

/** Мітка категорії витрат за id (базові + користувацькі). */
export function resolveExpenseCategoryMeta(
  id: string | null | undefined,
  customCategories: CategoryLikeInput = [],
): CategoryLike | null {
  return resolveExpenseOverride(id, customCategories);
}

export function getIncomeCategory(
  desc = "",
  overrideId: string | null = null,
): CategoryLike {
  if (overrideId) {
    const found =
      INCOME_CATEGORIES.find((c: CategoryLike) => c.id === overrideId) ||
      MCC_CATEGORIES.find((c: CategoryLike) => c.id === overrideId);
    if (found) return found;
  }
  const d = desc.toLowerCase();
  for (const cat of INCOME_CATEGORIES as readonly CategoryLike[]) {
    if ((cat.keywords ?? []).some((k: string) => d.includes(k))) return cat;
  }
  return INCOME_CATEGORIES[INCOME_CATEGORIES.length - 1] as CategoryLike; // in_other
}

export function getCategory(
  desc = "",
  mcc = 0,
  overrideId: string | null = null,
  customCategories: CategoryLikeInput = [],
): CategoryLike {
  if (overrideId) {
    const fromCustom = resolveExpenseOverride(overrideId, customCategories);
    if (fromCustom) return fromCustom;
    const found = MCC_CATEGORIES.find((c: CategoryLike) => c.id === overrideId);
    if (found) return found;
  }
  for (const cat of MCC_CATEGORIES as readonly CategoryLike[]) {
    if ((cat.mccs ?? []).includes(mcc)) return cat;
    if (
      (cat.keywords ?? []).some((k: string) => desc.toLowerCase().includes(k))
    )
      return cat;
  }
  return { id: "other", label: "💳 Інше", mccs: [], keywords: [] };
}
