import { memo } from "react";
/**
 * Дві кнопки-ярлики під Hero-ом: «Операції» / «Бюджети». Винесено щоб Hero
 * не ставав ще довшим і щоб префіксний фокус-стиль був консистентним.
 */
const NavButtonsImpl = function NavButtons({ onNavigate }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onNavigate("transactions")}
        className="flex-1 min-w-[140px] min-h-[44px] rounded-2xl border border-line bg-panel px-4 py-2.5 text-sm font-medium text-text shadow-card hover:border-emerald-500/30 hover:bg-emerald-500/[0.04] transition-colors"
      >
        Операції →
      </button>
      <button
        type="button"
        onClick={() => onNavigate("budgets")}
        className="flex-1 min-w-[140px] min-h-[44px] rounded-2xl border border-line bg-panel px-4 py-2.5 text-sm font-medium text-text shadow-card hover:border-emerald-500/30 hover:bg-emerald-500/[0.04] transition-colors"
      >
        Бюджети →
      </button>
    </div>
  );
};

export const NavButtons = memo(NavButtonsImpl);
