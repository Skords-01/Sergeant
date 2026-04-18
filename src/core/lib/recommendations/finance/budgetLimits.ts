// Rule: попередження/перевищення бюджетних лімітів (categoryId + limit).
// Легасі: читає `categorySpend` (raw keys), оскільки ліміти у користувачів
// вже збережені у тих же raw-id. Переведення на canonical — окрема міграція.

import type { Rule } from "../types";
import type { FinanceContext } from "../financeContext";

const BUILTIN_LABELS: Record<string, string> = {
  food: "Продукти",
  cafe: "Кафе та ресторани",
  restaurant: "Кафе та ресторани",
  transport: "Транспорт",
  entertainment: "Розваги",
  health: "Здоров'я",
  shopping: "Покупки",
  utilities: "Комунальні",
  subscriptions: "Підписки",
  other: "Інше",
};

function resolveLabel(
  categoryId: string,
  customCategories: { id: string; label: string }[],
): string {
  const custom = customCategories.find((c) => c.id === categoryId);
  if (custom) return custom.label;
  return BUILTIN_LABELS[categoryId] || categoryId;
}

export const budgetLimitsRule: Rule<FinanceContext> = {
  id: "finyk.budget_limits",
  module: "finyk",
  evaluate(ctx) {
    const recs = [];
    for (const limit of ctx.limits) {
      const catId = limit.categoryId;
      if (!catId) continue;
      if (!limit.limit || limit.limit <= 0) continue;

      const spent = ctx.categorySpend[catId] || 0;
      const pct = spent / limit.limit;
      const catLabel = resolveLabel(catId, ctx.customCategories);

      if (pct >= 1.4) {
        recs.push({
          id: `budget_over_${catId}`,
          module: "finyk" as const,
          priority: 90,
          icon: "💸",
          title: `Бюджет "${catLabel}" перевищено на ${Math.round((pct - 1) * 100)}%`,
          body: `Витрачено ${Math.round(spent).toLocaleString("uk-UA")} ₴ з ${Math.round(limit.limit).toLocaleString("uk-UA")} ₴`,
          action: "finyk",
        });
      } else if (pct >= 0.9) {
        recs.push({
          id: `budget_warn_${catId}`,
          module: "finyk" as const,
          priority: 60,
          icon: "⚠️",
          title: `Ліміт "${catLabel}" майже вичерпано`,
          body: `${Math.round(pct * 100)}% бюджету витрачено цього місяця`,
          action: "finyk",
        });
      }
    }
    return recs;
  },
};
