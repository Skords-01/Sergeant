import { Card } from "@shared/components/ui/Card";
/**
 * Пара карток «Дохід» / «Витрати» під Hero-ом. Стрілки з inline-SVG лишаємо
 * тут — це декоративні іконки конкретні для цієї секції.
 */
export function IncomeExpensePills({ income, spent, showBalance = true }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Card radius="lg">
        <div className="flex items-center gap-2 text-emerald-600">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
            <polyline points="17 6 23 6 23 12" />
          </svg>
          <span className="text-xs text-subtle">Дохід</span>
        </div>
        <p className="text-xl font-semibold mt-1 tabular-nums text-text">
          {showBalance
            ? `+${income.toLocaleString("uk-UA", { maximumFractionDigits: 0 })}`
            : "••••"}{" "}
          <span className="text-base font-medium text-muted">₴</span>
        </p>
      </Card>
      <Card radius="lg">
        <div className="flex items-center gap-2 text-red-500">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
            <polyline points="17 18 23 18 23 12" />
          </svg>
          <span className="text-xs text-subtle">Витрати</span>
        </div>
        <p className="text-xl font-semibold mt-1 tabular-nums text-text">
          {showBalance
            ? `−${spent.toLocaleString("uk-UA", { maximumFractionDigits: 0 })}`
            : "••••"}{" "}
          <span className="text-base font-medium text-muted">₴</span>
        </p>
      </Card>
    </div>
  );
}
