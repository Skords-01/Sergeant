import { cn } from "@shared/lib/cn";

export function NutritionHeader({
  busy,
  activePage,
  setActivePage,
  pantries,
  activePantry,
  activePantryId,
  setActivePantryId,
  onOpenPantryManager,
  onBackToHub,
}) {
  return (
    <div className="shrink-0 bg-panel/95 backdrop-blur-md border-b border-line/60 z-40 relative safe-area-pt">
      <div className="flex min-h-[68px] items-center px-4 py-2 sm:px-5 gap-3">
        {typeof onBackToHub === "function" ? (
          <button
            type="button"
            onClick={onBackToHub}
            className="shrink-0 w-10 h-10 min-w-[40px] min-h-[40px] -ml-1 flex items-center justify-center rounded-xl text-muted hover:text-text hover:bg-panelHi transition-colors border border-line/80 bg-panel/80"
            aria-label="До вибору модуля"
            title="До хабу"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </button>
        ) : (
          <div
            className="shrink-0 w-9 h-9 rounded-xl bg-nutrition/10 flex items-center justify-center text-nutrition border border-nutrition/20"
            aria-hidden
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 11c0 6 4 10 8 10s8-4 8-10" />
              <path d="M12 21V11" />
              <path d="M7 5c0 2 1 3 2 4M17 5c0 2-1 3-2 4" />
              <path d="M7 5c0-1 1-2 2-2s2 1 2 2c0 2-2 4-2 6" />
              <path d="M17 5c0-1-1-2-2-2s-2 1-2 2c0 2 2 4 2 6" />
            </svg>
          </div>
        )}

        <div className="min-w-0 flex-1">
          <span className="text-[9px] text-nutrition/70 font-bold tracking-widest uppercase block leading-none mb-0.5">
            ШВИДКИЙ АНАЛІЗ
          </span>
          <span className="text-[16px] font-semibold tracking-wide text-text block leading-tight">
            Харчування
          </span>
          <span className="text-[10px] text-subtle font-medium truncate">
            Фото → КБЖВ · список → інгредієнти · рецепти
          </span>
        </div>

        <select
          value={activePantry?.id || activePantryId || ""}
          onChange={(e) => setActivePantryId(e.target.value)}
          disabled={busy}
          className="h-10 rounded-xl bg-panel border border-line px-3 text-sm text-text outline-none focus:border-nutrition/60 max-w-[42vw]"
          aria-label="Обрати склад продуктів"
        >
          {(Array.isArray(pantries) ? pantries : []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name || "Склад"}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={onOpenPantryManager}
          disabled={busy}
          className="shrink-0 w-10 h-10 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-muted hover:text-text hover:bg-panelHi transition-colors border border-line/80 bg-panel/80"
          aria-label="Керування складами"
          title="Керування складами"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="5" cy="12" r="1.5" />
            <circle cx="19" cy="12" r="1.5" />
          </svg>
        </button>
      </div>

      <div className="px-4 sm:px-5 pb-3">
        <div className="flex gap-2">
          {[
            { id: "products", label: "Продукти" },
            { id: "recipes", label: "Рецепти" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActivePage(t.id)}
              className={cn(
                "h-10 px-4 rounded-2xl text-sm font-semibold border transition-colors",
                activePage === t.id
                  ? "bg-nutrition text-white border-nutrition"
                  : "bg-panel text-text border-line hover:border-muted",
              )}
              disabled={busy}
              aria-pressed={activePage === t.id}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

