/** Спільні константи UI модуля «Рутина» (без JSX) */

export const ROUTINE_THEME = {
  eyebrow: "text-[#d65d4f]",
  iconBox: "bg-[#fff0eb] border-[#f5c4b8]/80 text-[#c24133]",
  navActive: "text-[#c24133]",
  navBar: "bg-[#e85d4f]",
  chipOn: "border-[#f0a090] bg-[#fff5f2] text-text shadow-sm",
  chipOff: "border-line/60 bg-panel text-muted hover:text-text hover:bg-panelHi",
  dot: "bg-[#e85d4f]",
  monthSel: "bg-[#fff5f2] border-[#f0a090] ring-1 ring-[#f5c4b8]/50",
  done: "border-[#e0786c]/45 bg-[#fff0eb] text-[#b91c1c]",
  primary: "!bg-[#e0786c] hover:!bg-[#d46356] !text-white border-0 shadow-md",
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
