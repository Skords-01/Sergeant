import { cn } from "@shared/lib/cn";

export function NutritionHeader({ busy: _busy, onBackToHub }) {
  return (
    <div className="shrink-0 bg-panel/95 backdrop-blur-xl border-b border-line z-40 relative safe-area-pt">
      <div className="flex min-h-[68px] items-center px-4 py-2 sm:px-5 gap-3">
        {typeof onBackToHub === "function" ? (
          <button
            type="button"
            onClick={onBackToHub}
            className={cn(
              "shrink-0 h-10 min-h-[40px] -ml-1 pl-2 pr-3 gap-1.5",
              "flex items-center justify-center rounded-xl",
              "text-muted hover:text-text transition-all duration-200",
              "border border-line bg-panel/80 hover:bg-panelHi",
              "active:scale-95",
            )}
            aria-label="До хабу"
            title="До хабу"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
            <span className="text-sm font-semibold">Хаб</span>
          </button>
        ) : (
          <div
            className={cn(
              "shrink-0 w-10 h-10 rounded-xl flex items-center justify-center",
              "bg-gradient-to-br from-lime-100 to-green-100",
              "dark:from-lime-900/40 dark:to-green-900/30",
              "text-lime-600 dark:text-lime-400",
              "border border-lime-200/60 dark:border-lime-700/30",
              "shadow-sm",
            )}
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
          {/* eslint-disable-next-line sergeant-design/no-eyebrow-drift --
              Module hero kicker with bespoke light/dark lime tints at
              text-3xs; mirrors FizrukApp / RoutineApp header kickers. */}
          <span className="text-3xs text-lime-600/80 dark:text-lime-400/70 font-bold tracking-widest uppercase block leading-none mb-0.5">
            ХАРЧУВАННЯ
          </span>
          <span className="text-[16px] font-semibold tracking-wide text-text block leading-tight">
            Мій раціон
          </span>
        </div>
      </div>
    </div>
  );
}
