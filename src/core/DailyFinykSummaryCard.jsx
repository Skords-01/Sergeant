import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@shared/lib/cn";
import { safeReadLS, safeWriteLS } from "@shared/lib/storage.js";
import { openHubModule, openHubModuleWithAction } from "@shared/lib/hubNav";
import {
  computeDailyFinykSummary,
  DAILY_SUMMARY_DISMISS_KEY,
  isDailySummaryDismissedToday,
} from "./lib/dailyFinykSummary.js";

const STORAGE_WATCH_KEYS = new Set([
  "finyk_tx_cache",
  "finyk_manual_expenses_v1",
  "finyk_tx_cats",
  "finyk_tx_splits",
  "finyk_hidden_txs",
  "finyk_custom_cats_v1",
  "hub_routine_v1",
  "fizruk_workouts_v1",
  "nutrition_log_v1",
  DAILY_SUMMARY_DISMISS_KEY,
]);

function formatUAH(n) {
  return `${Math.round(n).toLocaleString("uk-UA")} ₴`;
}

function CoinsIcon({ className }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="8" cy="8" r="6" />
      <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
      <path d="M7 6h1v4" />
      <path d="M16.71 13.88l.7.71-2.82 2.82" />
    </svg>
  );
}

function PlusIcon({ className }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function CloseIcon({ className }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function requestAddExpense() {
  openHubModuleWithAction("finyk", "add_expense");
}

function useDailySummary() {
  const [summary, setSummary] = useState(() => computeDailyFinykSummary());
  const [dismissed, setDismissed] = useState(() =>
    isDailySummaryDismissedToday(),
  );

  const refresh = useCallback(() => {
    setSummary(computeDailyFinykSummary());
    setDismissed(isDailySummaryDismissedToday());
  }, []);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === null || STORAGE_WATCH_KEYS.has(e.key)) refresh();
    };
    window.addEventListener("storage", onStorage);

    // Легке автооновлення кожні 5 хв, щоб ранішній стан змінився на вечірній
    // (наприклад, reminder_no_expenses після 18:00) без перезавантаження.
    const id = setInterval(refresh, 5 * 60 * 1000);

    return () => {
      window.removeEventListener("storage", onStorage);
      clearInterval(id);
    };
  }, [refresh]);

  const dismissToday = useCallback(() => {
    const todayKey = computeDailyFinykSummary().todayKey;
    safeWriteLS(DAILY_SUMMARY_DISMISS_KEY, {
      date: todayKey,
      at: Date.now(),
    });
    setDismissed(true);
  }, []);

  return { summary, dismissed, dismissToday, refresh };
}

function Header({ eyebrow, title, onDismiss, dismissLabel }) {
  return (
    <div className="flex items-start justify-between gap-2 mb-2">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-600/80 dark:text-brand-400/80">
          {eyebrow}
        </p>
        <h3 className="text-base font-bold text-text leading-snug">{title}</h3>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={dismissLabel || "Згорнути до завтра"}
          title={dismissLabel || "Згорнути до завтра"}
          className={cn(
            "shrink-0 w-7 h-7 rounded-lg flex items-center justify-center",
            "text-muted hover:text-text",
            "hover:bg-line/40 dark:hover:bg-white/5 transition-colors",
          )}
        >
          <CloseIcon />
        </button>
      )}
    </div>
  );
}

function HasExpensesContent({ summary }) {
  const { todaySpent, topCategory, txCount } = summary;
  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2">
        <span className="text-3xl font-bold tabular-nums text-text leading-none">
          {formatUAH(todaySpent)}
        </span>
        <span className="text-xs text-muted pb-1">
          {txCount} {txCount === 1 ? "запис" : "записів"}
        </span>
      </div>

      {topCategory && (
        <div
          className={cn(
            "flex items-center justify-between gap-2",
            "rounded-xl border border-brand-100/60 bg-white/60 dark:bg-white/5 dark:border-brand-800/30",
            "px-3 py-2",
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">
              Топ категорія
            </span>
            <span className="text-sm font-medium text-text truncate">
              {topCategory.label}
            </span>
          </div>
          <div className="text-right shrink-0">
            <div className="text-sm font-semibold tabular-nums text-text">
              {formatUAH(topCategory.amount)}
            </div>
            <div className="text-[10px] text-muted">{topCategory.pct}%</div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={requestAddExpense}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg",
            "bg-brand-500 hover:bg-brand-600 active:bg-brand-700",
            "text-white text-xs font-semibold transition-colors",
          )}
        >
          <PlusIcon />
          Додати витрату
        </button>
        <button
          type="button"
          onClick={() => openHubModule("finyk")}
          className={cn(
            "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg",
            "text-xs font-medium text-muted hover:text-text",
            "hover:bg-line/40 dark:hover:bg-white/5 transition-colors",
          )}
        >
          Відкрити Фінік →
        </button>
      </div>
    </div>
  );
}

function ReminderContent({ kind }) {
  const copy =
    kind === "reminder_active_day"
      ? {
          text: "Активний день — не забудь зафіксувати витрати. Хочеш додати зараз?",
        }
      : kind === "reminder_no_expenses"
        ? {
            text: "Сьогодні витрат ще не було. Якщо щось витратив — пара секунд на запис.",
          }
        : {
            text: "Сьогодні витрат ще не було. Додавай їх, коли зручно.",
          };

  return (
    <div className="space-y-3">
      <p className="text-sm text-text/90 leading-relaxed">{copy.text}</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={requestAddExpense}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg",
            "bg-brand-500 hover:bg-brand-600 active:bg-brand-700",
            "text-white text-xs font-semibold transition-colors",
          )}
        >
          <PlusIcon />
          Додати витрату
        </button>
      </div>
    </div>
  );
}

export function DailyFinykSummaryCard() {
  const { summary, dismissed, dismissToday } = useDailySummary();

  // Додатковий guard: якщо користувач ховав цей блок з hub-prefs — поважаємо.
  const hubPrefs = useMemo(() => safeReadLS("hub_prefs_v1", {}) || {}, []);
  if (hubPrefs.showDailyFinykSummary === false) return null;

  if (summary.status === "hidden") return null;
  if (dismissed) return null;

  const showReminder =
    summary.status === "reminder_no_expenses" ||
    summary.status === "reminder_active_day" ||
    summary.status === "quiet";

  const eyebrow = "Фінік · сьогодні";
  const title =
    summary.status === "has_expenses"
      ? formatUAH(summary.todaySpent)
      : summary.status === "reminder_active_day"
        ? "Активний день"
        : summary.status === "reminder_no_expenses"
          ? "Нагадування про витрати"
          : "Сьогодні";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border p-4",
        "bg-gradient-to-br from-brand-50/80 to-teal-50/40",
        "dark:from-brand-900/20 dark:to-teal-900/10",
        "border-brand-100/60 dark:border-brand-800/30",
        "shadow-card",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "shrink-0 w-10 h-10 rounded-xl flex items-center justify-center",
            "bg-white/70 dark:bg-white/10 text-brand-600 dark:text-brand-400",
            "shadow-sm",
          )}
        >
          <CoinsIcon />
        </div>
        <div className="flex-1 min-w-0">
          <Header
            eyebrow={eyebrow}
            title={
              summary.status === "has_expenses" ? "Витрати за сьогодні" : title
            }
            onDismiss={dismissToday}
          />

          {summary.status === "has_expenses" && (
            <HasExpensesContent summary={summary} />
          )}

          {showReminder && <ReminderContent kind={summary.status} />}
        </div>
      </div>
    </div>
  );
}
