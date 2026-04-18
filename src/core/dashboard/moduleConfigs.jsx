/**
 * Hub Dashboard — module configuration map.
 *
 * Single source of truth for the four module tiles on the hub dashboard:
 * icon, label, module id, styling classes, and a `getPreview()` reader that
 * summarises the latest quick-stats each module writes to localStorage.
 */

import { Icon } from "@shared/components/ui/Icon";

function safeReadJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const MODULE_CONFIGS = {
  finyk: {
    icon: <Icon name="credit-card" size={18} />,
    label: "Фінік",
    module: "finyk",
    colorClass: "bg-finyk-soft text-finyk",
    borderClass: "border-brand-200/60",
    hoverGradient: "from-brand-50 to-teal-50/50",
    ringVariant: "finyk",
    description: "Транзакції та бюджети",
    getPreview: () => {
      const stats = safeReadJSON("finyk_quick_stats");
      if (!stats) return { main: null, sub: "Відстежуй витрати" };
      return {
        main: stats.todaySpent
          ? `${stats.todaySpent.toLocaleString()} грн`
          : null,
        sub: stats.budgetLeft
          ? `Залишок: ${stats.budgetLeft.toLocaleString()}`
          : null,
      };
    },
  },
  fizruk: {
    icon: <Icon name="dumbbell" size={18} />,
    label: "Фізрук",
    module: "fizruk",
    colorClass: "bg-fizruk-soft text-fizruk",
    borderClass: "border-teal-200/60",
    hoverGradient: "from-teal-50 to-brand-50/50",
    ringVariant: "fizruk",
    description: "Тренування та прогрес",
    getPreview: () => {
      const stats = safeReadJSON("fizruk_quick_stats");
      if (!stats) return { main: null, sub: "Плануй тренування" };
      return {
        main: stats.weekWorkouts ? `${stats.weekWorkouts} тренувань` : null,
        sub: stats.streak ? `Серія: ${stats.streak} днів` : null,
      };
    },
  },
  routine: {
    icon: <Icon name="check" size={18} strokeWidth={2.5} />,
    label: "Рутина",
    module: "routine",
    colorClass: "bg-routine-surface text-routine",
    borderClass: "border-coral-200/60",
    hoverGradient: "from-coral-50 to-routine-surface/50",
    ringVariant: "routine",
    description: "Звички та щоденні цілі",
    getPreview: () => {
      const stats = safeReadJSON("routine_quick_stats");
      if (!stats) return { main: null, sub: "Формуй звички", progress: 0 };
      return {
        main:
          stats.todayDone !== undefined
            ? `${stats.todayDone}/${stats.todayTotal}`
            : null,
        sub: stats.streak ? `Серія: ${stats.streak} днів` : null,
        progress: stats.todayTotal
          ? (stats.todayDone / stats.todayTotal) * 100
          : 0,
      };
    },
  },
  nutrition: {
    icon: <Icon name="utensils" size={18} />,
    label: "Харчування",
    module: "nutrition",
    colorClass: "bg-nutrition-soft text-nutrition",
    borderClass: "border-lime-200/60",
    hoverGradient: "from-lime-50 to-nutrition-soft/50",
    ringVariant: "nutrition",
    description: "КБЖВ та раціон",
    getPreview: () => {
      const stats = safeReadJSON("nutrition_quick_stats");
      if (!stats) return { main: null, sub: "Рахуй калорії", progress: 0 };
      return {
        main: stats.todayCal ? `${stats.todayCal} ккал` : null,
        sub: stats.calGoal ? `Ціль: ${stats.calGoal} ккал` : null,
        progress: stats.calGoal ? (stats.todayCal / stats.calGoal) * 100 : 0,
      };
    },
  },
};

export const MODULE_ORDER_DEFAULT = ["finyk", "fizruk", "routine", "nutrition"];
