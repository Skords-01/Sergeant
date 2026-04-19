export function FoodHitRow({ p, badge, onPick }) {
  return (
    <li>
      <button
        type="button"
        className="w-full text-left px-3 py-2.5 hover:bg-panelHi/60 active:bg-panelHi transition-colors"
        onClick={onPick}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm text-text font-semibold truncate">
            {[p.name, p.brand].filter(Boolean).join(" · ")}
            {badge && (
              <span className="ml-1 text-2xs text-subtle">{badge}</span>
            )}
          </div>
          <div className="text-xs font-semibold text-nutrition shrink-0">
            {Math.round(p.per100?.kcal || 0)} ккал
          </div>
        </div>
        <div className="text-xs text-subtle mt-0.5">
          Б {Math.round(p.per100?.protein_g || 0)}г · Ж{" "}
          {Math.round(p.per100?.fat_g || 0)}г · В{" "}
          {Math.round(p.per100?.carbs_g || 0)}г{" "}
          <span className="opacity-60">на 100г</span>
        </div>
      </button>
    </li>
  );
}
