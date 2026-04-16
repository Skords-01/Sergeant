import { useCoachInsight } from "./useCoachInsight.js";
import { cn } from "@shared/lib/cn";

function SpinnerIcon() {
  return (
    <svg
      className="animate-spin h-4 w-4 text-violet-500"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 2v6h-6" />
      <path d="M3 12a9 9 0 0115-6.7L21 8" />
      <path d="M3 22v-6h6" />
      <path d="M21 12a9 9 0 01-15 6.7L3 16" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

export function CoachInsightCard({ onOpenChat }) {
  const { insight, loading, error, refresh } = useCoachInsight();

  const handleDiscuss = () => {
    if (typeof onOpenChat === "function") {
      const coachContext = insight
        ? `[Коуч-контекст]\nПерсональне повідомлення дня:\n"${insight}"\n\nЯ хочу обговорити цей інсайт або отримати більше порад.`
        : "[Коуч-контекст]\nЯ хочу поговорити з персональним коучем.";
      onOpenChat(coachContext);
    }
  };

  return (
    <div className={cn(
      "rounded-2xl border border-violet-200/60 bg-gradient-to-br from-violet-50/80 to-purple-50/60 p-4",
      "dark:border-violet-800/40 dark:from-violet-950/40 dark:to-purple-950/30",
    )}>
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-base shadow-sm">
          🤖
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-xs font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wide">
              Коуч · сьогодні
            </span>
            <button
              onClick={refresh}
              disabled={loading}
              className={cn(
                "p-1 rounded-lg text-violet-400 hover:text-violet-600 hover:bg-violet-100/60 transition-colors",
                "dark:hover:text-violet-300 dark:hover:bg-violet-900/40",
                loading && "opacity-40 cursor-not-allowed",
              )}
              title="Оновити повідомлення"
              aria-label="Оновити повідомлення коуча"
            >
              {loading ? <SpinnerIcon /> : <RefreshIcon />}
            </button>
          </div>

          {loading && !insight && (
            <p className="text-sm text-muted animate-pulse">Коуч готує повідомлення…</p>
          )}

          {error && !insight && (
            <p className="text-sm text-rose-500 dark:text-rose-400">
              {error}
            </p>
          )}

          {insight && (
            <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">
              {insight}
            </p>
          )}

          {!loading && !error && !insight && (
            <p className="text-sm text-muted">
              Коуч аналізує твої дані…
            </p>
          )}

          <div className="mt-3">
            <button
              onClick={handleDiscuss}
              className={cn(
                "inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors",
                "bg-violet-500 text-white hover:bg-violet-600 active:bg-violet-700",
                "dark:bg-violet-600 dark:hover:bg-violet-500",
              )}
            >
              <ChatIcon />
              Обговорити
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
