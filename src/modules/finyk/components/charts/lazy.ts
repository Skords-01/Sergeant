import { lazy } from "react";

// Lazy-loaded chart components for the finyk module.
// Keeps heavy chart code out of the initial dashboard bundle so the first
// render of Overview / Analytics / Budgets is faster. Each wrapper re-exports
// the original named component via a default export adapter so existing props
// and rendering logic stay untouched.

export const BudgetTrendChart = lazy(() =>
  import("../BudgetTrendChart.jsx").then((m) => ({
    default: m.BudgetTrendChart,
  })),
);

export const CategoryChart = lazy(() =>
  import("../CategoryChart.jsx").then((m) => ({
    default: m.CategoryChart,
  })),
);

export const NetworthChart = lazy(() =>
  import("../NetworthChart.jsx").then((m) => ({
    default: m.NetworthChart,
  })),
);

export const CategoryPieChart = lazy(() =>
  import("../analytics/CategoryPieChart.jsx").then((m) => ({
    default: m.CategoryPieChart,
  })),
);
