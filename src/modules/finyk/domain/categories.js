// Pure domain helpers for categories of the Finyk module.
// Жодних React-хуків і жодного localStorage. Містить:
//  - визначення кольорів категорій (джерело правди для всіх графіків);
//  - побудову списку категорій для селектів/графіків;
//  - побудову списку сум по категоріях для статистики.
// `getCategory`, `resolveExpenseCategoryMeta`, `calcCategorySpent` реекспортуються
// з `utils`, щоб UI/хуки могли імпортувати все з одного domain-модуля.
import { mergeExpenseCategoryDefinitions } from "../constants";
import {
  calcCategorySpent,
  getCategory,
  getIncomeCategory,
  resolveExpenseCategoryMeta,
} from "../utils";

export {
  calcCategorySpent,
  getCategory,
  getIncomeCategory,
  resolveExpenseCategoryMeta,
};

// Стабільні кольори для базових категорій витрат.
const CAT_COLORS = {
  food: "#10b981",
  restaurant: "#f59e0b",
  transport: "#3b82f6",
  subscriptions: "#8b5cf6",
  health: "#ec4899",
  shopping: "#f97316",
  entertainment: "#14b8a6",
  sport: "#22c55e",
  beauty: "#e879f9",
  smoking: "#78716c",
  education: "#6366f1",
  travel: "#0ea5e9",
  debt: "#ef4444",
  charity: "#84cc16",
  utilities: "#64748b",
  other: "#94a3b8",
};

// Палітра для невідомих категорій — використовуємо idx, щоб кольори
// не стрибали між рендерами.
const FALLBACK_COLORS = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#0ea5e9",
  "#f97316",
  "#14b8a6",
  "#8b5cf6",
  "#22c55e",
  "#e879f9",
];

// Повертає HEX-колір для категорії: базовий → користувацький → з палітри.
export function getCatColor(categoryId, customCategories = [], idx = 0) {
  if (CAT_COLORS[categoryId]) return CAT_COLORS[categoryId];
  const custom = Array.isArray(customCategories)
    ? customCategories.find((c) => c.id === categoryId)
    : null;
  if (custom?.color) return custom.color;
  return FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
}

// Повний список категорій витрат (базові + користувацькі). За замовчуванням
// виключає псевдо-категорію доходу `income`, бо вона не потрібна у фільтрах
// бюджетів та графіках витрат.
export function buildExpenseCategoryList(
  customCategories = [],
  { excludeIncome = true } = {},
) {
  const all = mergeExpenseCategoryDefinitions(customCategories);
  return excludeIncome ? all.filter((c) => c.id !== "income") : all;
}

// Сумарні витрати по кожній категорії для заданого списку транзакцій.
// Повертає відсортований масив лише з категоріями, де spent > 0 —
// готовий для рендеру карток/графіків.
export function getCategorySpendList(
  transactions,
  { txCategories = {}, txSplits = {}, customCategories = [] } = {},
) {
  return buildExpenseCategoryList(customCategories)
    .map((cat) => ({
      ...cat,
      spent: calcCategorySpent(
        transactions,
        cat.id,
        txCategories,
        txSplits,
        customCategories,
      ),
    }))
    .filter((c) => c.spent > 0)
    .sort((a, b) => b.spent - a.spent);
}
