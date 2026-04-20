/**
 * Sergeant Design System — Routine Module Theme Constants
 *
 * Soft & Organic aesthetic with coral accent.
 * Inspired by: Duolingo gamification, warm friendly feel
 */

export const ROUTINE_THEME = {
  // Text accents
  eyebrow: "text-routine-strong dark:text-routine",
  heroKicker: "text-routine-strong dark:text-routine",

  // Cards & surfaces
  statCard:
    "rounded-2xl bg-panel/80 border border-coral-100/60 dark:border-coral-800/30 p-3 text-center shadow-card backdrop-blur-sm",
  statCardHighlight:
    "rounded-2xl bg-routine-surface/80 border border-routine-ring/50 dark:border-routine/30 p-3 text-center shadow-card",

  // Empty state
  emptyStateWarm:
    "rounded-2xl border border-coral-100/60 dark:border-routine/25 bg-coral-50/50 dark:bg-routine/8 p-6 text-center shadow-card",

  // Links & accents
  linkAccent:
    "font-semibold text-routine-strong dark:text-routine hover:text-routine-hover underline decoration-routine-ring/60 dark:decoration-routine/50 transition-colors",

  // Habit list items
  habitRowAccent: "border-l-routine",
  habitRowDone: "border-l-routine bg-coral-50/50 dark:bg-routine/10",

  // Icon containers
  iconBox:
    "bg-routine-surface dark:bg-routine/12 border-coral-100 dark:border-routine/30 text-routine-strong dark:text-routine",

  // Navigation
  navActive: "text-routine-strong dark:text-routine",
  navBar: "bg-routine",

  // Chips/pills
  chipOn:
    "border-routine-ring dark:border-routine/40 bg-routine-surface dark:bg-routine/15 text-routine-strong dark:text-routine shadow-sm",
  chipOff:
    "border-line bg-panel text-muted hover:text-text hover:bg-panelHi transition-colors",

  // Calendar dots
  dot: "bg-routine",
  dotComplete: "bg-routine/80",

  // Month selector
  monthSel:
    "bg-routine-surface dark:bg-routine/15 border-routine-ring dark:border-routine/40 ring-1 ring-coral-100/50 dark:ring-routine/30",

  // Completion states
  done: "border-routine/45 bg-routine-surface dark:bg-routine/12 text-routine-strong dark:text-routine",
  doneCheck: "text-routine-strong dark:text-routine",

  // Primary button
  primary:
    "bg-routine hover:bg-routine-hover text-white border-0 shadow-sm transition-all duration-200 active:scale-[0.98]",
  primarySoft:
    "bg-routine-surface hover:bg-coral-100 text-routine-strong dark:text-routine border border-routine-ring/50 transition-all duration-200",

  // Secondary/ghost
  secondary:
    "bg-panel hover:bg-panelHi text-text border border-line transition-all duration-200",

  // Progress ring colors
  progressTrack: "text-coral-100 dark:text-coral-900/30",
  progressFill: "text-routine-strong dark:text-routine",

  // Hero card gradient
  heroGradient: "bg-hero-coral",

  // Success animation colors
  successPulse: "rgba(249, 112, 102, 0.4)",
};

// Time mode options
export type RoutineTimeModeId = "today" | "tomorrow" | "week" | "month";
export interface RoutineTimeMode {
  id: RoutineTimeModeId;
  label: string;
}
export const ROUTINE_TIME_MODES: readonly RoutineTimeMode[] = [
  { id: "today", label: "Сьогодні" },
  { id: "tomorrow", label: "Завтра" },
  { id: "week", label: "Тиждень" },
  { id: "month", label: "Місяць" },
];

// Recurrence patterns
export interface RecurrenceOption {
  value: "daily" | "weekdays" | "weekly" | "monthly" | "once";
  label: string;
  /**
   * Compact label used by the segmented chip row in `HabitForm`.
   * Falls back to `label` when omitted. Full `label` is still used in
   * any remaining `<option>` contexts so existing selects don't lose
   * their clarifying copy.
   */
  shortLabel?: string;
}
export const RECURRENCE_OPTIONS: readonly RecurrenceOption[] = [
  { value: "daily", label: "Щодня" },
  { value: "weekdays", label: "Будні (пн-пт)", shortLabel: "Будні" },
  { value: "weekly", label: "Обрані дні тижня", shortLabel: "По тижню" },
  {
    value: "monthly",
    label: "Щомісяця (число; лютий - останній день)",
    shortLabel: "Щомісяця",
  },
  { value: "once", label: "Одноразово (одна дата)", shortLabel: "Одноразово" },
];

// Weekday labels (Ukrainian, Monday first)
export const WEEKDAY_LABELS: readonly string[] = [
  "Пн",
  "Вт",
  "Ср",
  "Чт",
  "Пт",
  "Сб",
  "Нд",
];

// Gamification streak thresholds
export const STREAK_MILESTONES: readonly number[] = [
  3, 7, 14, 21, 30, 60, 90, 180, 365,
];

// Get milestone message based on streak count
export function getStreakMessage(streak: number): string | null {
  if (streak >= 365) return "Неймовірно! Рік послідовності!";
  if (streak >= 180) return "Півроку! Ти - легенда!";
  if (streak >= 90) return "3 місяці! Це вже стиль життя!";
  if (streak >= 60) return "2 місяці! Звичка закріплена!";
  if (streak >= 30) return "Місяць! Чудовий результат!";
  if (streak >= 21) return "21 день! Звичка формується!";
  if (streak >= 14) return "2 тижні! Так тримати!";
  if (streak >= 7) return "Тиждень! Гарний старт!";
  if (streak >= 3) return "3 дні поспіль!";
  return null;
}
