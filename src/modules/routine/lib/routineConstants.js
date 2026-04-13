/** Спільні константи UI модуля «Рутина» (без JSX) */

export const ROUTINE_THEME = {
  eyebrow: "text-routine-eyebrow",
  /** Заголовок картки-огляду (hero) */
  heroKicker: "text-routine-kicker/90",
  /** Картки метрик у hero */
  statCard:
    "rounded-2xl bg-panel/70 border border-routine-line/50 p-3 text-center shadow-sm",
  statCardEmerald:
    "rounded-2xl bg-panel/70 border border-emerald-200/60 p-3 text-center shadow-sm",
  emptyStateWarm:
    "rounded-2xl border border-routine-line/60 bg-routine-surface3 p-6 text-center shadow-card",
  linkAccent:
    "font-semibold text-routine-strong underline decoration-routine-ring/80",
  habitRowAccent: "border-l-routine",
  iconBox: "bg-routine-surface border-routine-line/80 text-routine-strong",
  navActive: "text-routine-strong",
  navBar: "bg-routine-nav",
  chipOn: "border-routine-ring bg-routine-surface2 text-text shadow-sm",
  chipOff:
    "border-line/60 bg-panel text-muted hover:text-text hover:bg-panelHi",
  dot: "bg-routine-nav",
  monthSel:
    "bg-routine-surface2 border-routine-ring ring-1 ring-routine-line/50",
  done: "border-routine/45 bg-routine-surface text-routine-done",
  primary: "!bg-routine hover:!bg-routine-hover !text-white border-0 shadow-md",
};

export const ROUTINE_TIME_MODES = [
  { id: "today", label: "Сьогодні" },
  { id: "tomorrow", label: "Завтра" },
  { id: "week", label: "Тиждень" },
  { id: "month", label: "Місяць" },
];

export const RECURRENCE_OPTIONS = [
  { value: "daily", label: "Щодня" },
  { value: "weekdays", label: "Будні (пн–пт)" },
  { value: "weekly", label: "Обрані дні тижня" },
  { value: "monthly", label: "Щомісяця (число; лютий — останній день)" },
  { value: "once", label: "Одноразово (одна дата)" },
];

export const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];
