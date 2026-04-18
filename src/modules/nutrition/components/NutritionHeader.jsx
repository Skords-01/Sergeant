import { cn } from "@shared/lib/cn";

export function NutritionHeader({ busy: _busy, onBackToHub }) {
  return (
    <div className="shrink-0 bg-panel/95 backdrop-blur-xl border-b border-line/60 z-40 relative safe-area-pt">
      <div className="flex min-h-[68px] items-center px-4 py-2 sm:px-5 gap-3">
        {typeof onBackToHub === "function" ? (
          <button
            type="button"
            onClick={onBackToHub}
            className={cn(
              "shrink-0 w-10 h-10 min-w-[40px] min-h-[40px] -ml-1",
              "flex items-center justify-center rounded-xl",
              "text-muted hover:text-text transition-all duration-200",
              "border border-line/80 bg-panel/80 hover:bg-panelHi",
              "active:scale-95",
            )}
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
          <span className="text-[9px] text-lime-600/80 dark:text-lime-400/70 font-bold tracking-widest uppercase block leading-none mb-0.5">
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
