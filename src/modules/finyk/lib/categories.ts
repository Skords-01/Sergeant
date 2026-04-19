import { MCC_CATEGORIES, INCOME_CATEGORIES } from "../constants";

function resolveExpenseOverride(overrideId, customCategories = []) {
  if (!overrideId) return null;
  const fromMcc = MCC_CATEGORIES.find((c) => c.id === overrideId);
  if (fromMcc) return fromMcc;
  const custom = customCategories.find((c) => c.id === overrideId);
  if (custom) {
    return {
      id: custom.id,
      label: custom.label,
      mccs: [],
      keywords: [],
    };
  }
  return null;
}

/** Мітка категорії витрат за id (базові + користувацькі). */
export function resolveExpenseCategoryMeta(id, customCategories = []) {
  return resolveExpenseOverride(id, customCategories);
}

export function getIncomeCategory(desc = "", overrideId = null) {
  if (overrideId) {
    const found =
      INCOME_CATEGORIES.find((c) => c.id === overrideId) ||
      MCC_CATEGORIES.find((c) => c.id === overrideId);
    if (found) return found;
  }
  const d = desc.toLowerCase();
  for (const cat of INCOME_CATEGORIES) {
    if (cat.keywords.some((k) => d.includes(k))) return cat;
  }
  return INCOME_CATEGORIES[INCOME_CATEGORIES.length - 1]; // in_other
}

export function getCategory(
  desc = "",
  mcc = 0,
  overrideId = null,
  customCategories = [],
) {
  if (overrideId) {
    const fromCustom = resolveExpenseOverride(overrideId, customCategories);
    if (fromCustom) return fromCustom;
    const found = MCC_CATEGORIES.find((c) => c.id === overrideId);
    if (found) return found;
  }
  for (const cat of MCC_CATEGORIES) {
    if (cat.mccs.includes(mcc)) return cat;
    if (cat.keywords.some((k) => desc.toLowerCase().includes(k))) return cat;
  }
  return { id: "other", label: "💳 Інше", mccs: [], keywords: [] };
}
