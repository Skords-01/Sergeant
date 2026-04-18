// Реєстр правил модуля Finyk. Порядок у масиві — JUST for readability, фактичний
// порядок у UI диктується `priority`. Додавайте сюди нові правила, не пишіть
// інлайн-логіку в `recommendationEngine.buildFinanceRecs`.

import type { Rule } from "../types";
import type { FinanceContext } from "../financeContext";
import { budgetLimitsRule } from "./budgetLimits";
import { spendingVelocityRule } from "./spendingVelocity";
import { frequentNoBudgetRule } from "./frequentNoBudget";
import { goalProgressRule } from "./goalProgress";

export const FINANCE_RULES: readonly Rule<FinanceContext>[] = [
  budgetLimitsRule,
  spendingVelocityRule,
  frequentNoBudgetRule,
  goalProgressRule,
];
