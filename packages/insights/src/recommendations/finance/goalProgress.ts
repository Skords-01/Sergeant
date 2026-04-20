// Rule: прогрес фінансових цілей — повідомляємо коли до фінішу лишилось
// 20%. Працює з budget.type === "goal", порівнюючи savedAmount/targetAmount.

import type { Rule } from "../types.js";
import type { FinanceContext } from "../financeContext.js";

interface Goal {
  id?: string;
  name?: string;
  type: string;
  targetAmount?: number;
  savedAmount?: number;
}

export const goalProgressRule: Rule<FinanceContext> = {
  id: "finyk.goal_progress",
  module: "finyk",
  evaluate(ctx) {
    const goals = ctx.budgets.filter((b) => b.type === "goal") as Goal[];
    const recs = [];
    for (const g of goals) {
      const target = Number(g.targetAmount) || 0;
      const saved = Number(g.savedAmount) || 0;
      if (target <= 0 || saved <= 0) continue;
      const p = saved / target;
      if (p < 0.8 || p >= 1) continue;
      const remaining = target - saved;
      recs.push({
        id: `goal_almost_${g.id || g.name || "unnamed"}`,
        module: "finyk" as const,
        priority: 65,
        icon: "🎯",
        title: `Ціль "${g.name ?? ""}" майже досягнута`,
        body: `Залишилось ${Math.round(remaining).toLocaleString("uk-UA")} ₴ (${Math.round(p * 100)}%)`,
        action: "finyk",
      });
    }
    return recs;
  },
};
