import { useEffect, useState } from "react";
import { cn } from "@shared/lib/cn";
import { Icon } from "@shared/components/ui/Icon";
import { useCoachInsight } from "./useCoachInsight.js";

// localStorage flag used to auto-expand the insights panel at most once per
// calendar day when a coach insight is present. After the first expand on a
// given day (automatic or manual), we stamp today's date here so subsequent
// dashboard opens keep the panel quietly collapsed.
const AUTO_OPEN_KEY = "hub_insights_auto_opened_v1";

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function wasAutoOpenedToday() {
  try {
    return localStorage.getItem(AUTO_OPEN_KEY) === todayKey();
  } catch {
    return false;
  }
}

function markAutoOpenedToday() {
  try {
    localStorage.setItem(AUTO_OPEN_KEY, todayKey());
  } catch {}
}

const MODULE_ACCENT = {
  finyk: "bg-finyk",
  fizruk: "bg-fizruk",
  routine: "bg-routine",
  nutrition: "bg-nutrition",
  hub: "bg-primary",
};

function RecRow({ rec, onAction, onDismiss }) {
  const accent = MODULE_ACCENT[rec.module] || "bg-primary";
  return (
    <div
      className={cn(
        "relative flex gap-3 rounded-xl border border-line bg-bg px-3 py-2.5",
      )}
    >
      <div
        className={cn(
          "absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full",
          accent,
        )}
        aria-hidden
      />
      <div className="pl-1 flex-1 min-w-0">
        <p className="text-sm font-semibold text-text leading-snug">
          {rec.icon && (
            <span className="mr-1" aria-hidden>
              {rec.icon}
            </span>
          )}
          {rec.title}
        </p>
        {rec.body && (
          <p className="text-xs text-muted mt-0.5 leading-relaxed">
            {rec.body}
          </p>
        )}
        {rec.action && (
          <button
            type="button"
            onClick={() => onAction(rec.action)}
            className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-text hover:text-primary transition-colors"
          >
            Відкрити
            <Icon name="chevron-right" size={12} strokeWidth={2.5} />
          </button>
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={() => onDismiss(rec.id)}
          aria-label="Прибрати"
          title="Прибрати"
          className="shrink-0 -mr-1 -mt-1 w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:text-text hover:bg-panelHi transition-colors"
        >
          <Icon name="close" size={14} />
        </button>
      )}
    </div>
  );
}

function CoachRow({ insight, loading, error, onDiscuss, onRefresh }) {
  if (loading && !insight) {
    return (
      <div className="rounded-xl border border-line bg-bg px-3 py-2.5">
        <p className="text-xs text-muted animate-pulse">
          Коуч готує повідомлення…
        </p>
      </div>
    );
  }
  if (error && !insight) {
    return null;
  }
  if (!insight) return null;

  return (
    <div className="relative rounded-xl border border-line bg-bg px-3 py-2.5">
      <div
        className="absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full bg-primary"
        aria-hidden
      />
      <div className="pl-1">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-2xs font-semibold uppercase tracking-wider text-muted">
            Коуч
          </span>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            aria-label="Оновити повідомлення коуча"
            title="Оновити"
            className={cn(
              "w-6 h-6 rounded-md flex items-center justify-center",
              "text-muted hover:text-text hover:bg-panelHi transition-colors",
              loading && "opacity-40 cursor-not-allowed",
            )}
          >
            <Icon name="refresh-cw" size={12} strokeWidth={2.5} />
          </button>
        </div>
        <p className="text-xs text-text/90 leading-relaxed">{insight}</p>
        {onDiscuss && (
          <button
            type="button"
            onClick={onDiscuss}
            className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-text hover:text-primary transition-colors"
          >
            Обговорити
            <Icon name="chevron-right" size={12} strokeWidth={2.5} />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Unified collapsible "Insights" panel that merges recommendation nudges and
 * the daily coach insight into one compact block. Replaces three separate
 * cards (HubRecommendations, CoachInsightCard, DailyFinykSummaryCard) on the
 * dashboard.
 */
export function HubInsightsPanel({
  items,
  onOpenModule,
  onOpenChat,
  onDismiss,
}) {
  const [open, setOpen] = useState(false);
  const { insight, loading, error, refresh } = useCoachInsight();

  const hasCoach = Boolean(insight) || Boolean(loading);
  const coachCount = insight ? 1 : 0;
  const total = (items?.length || 0) + coachCount;

  // Auto-expand once per day when a coach insight is available so the user
  // actually notices it — without re-opening on every subsequent dashboard
  // visit that day.
  useEffect(() => {
    if (!insight) return;
    if (wasAutoOpenedToday()) return;
    setOpen(true);
    markAutoOpenedToday();
  }, [insight]);

  if (total === 0) return null;

  const handleDiscuss = () => {
    if (typeof onOpenChat !== "function") return;
    const ctx = insight
      ? `[Коуч-контекст]\nПерсональне повідомлення дня:\n"${insight}"\n\nЯ хочу обговорити цей інсайт або отримати більше порад.`
      : "[Коуч-контекст]\nЯ хочу поговорити з персональним коучем.";
    onOpenChat(ctx);
  };

  return (
    <section className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl",
          "border border-line bg-panel",
          "hover:bg-panelHi transition-colors",
        )}
      >
        <span className="flex items-center gap-2 text-xs font-semibold text-text">
          Інсайти
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-panelHi text-2xs font-bold text-muted">
            {total}
          </span>
        </span>
        <Icon
          name="chevron-right"
          size={15}
          strokeWidth={2.5}
          className={cn(
            "text-muted transition-transform duration-200",
            open && "rotate-90",
          )}
        />
      </button>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-in-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-2 pt-1">
            {hasCoach && (
              <CoachRow
                insight={insight}
                loading={loading}
                error={error}
                onRefresh={refresh}
                onDiscuss={onOpenChat ? handleDiscuss : null}
              />
            )}
            {items?.map((rec) => (
              <RecRow
                key={rec.id}
                rec={rec}
                onAction={(m) => onOpenModule(m)}
                onDismiss={onDismiss}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
