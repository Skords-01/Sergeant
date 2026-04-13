import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@shared/lib/cn";
import { Button } from "@shared/components/ui/Button";
import { Input } from "@shared/components/ui/Input";
import {
  loadRoutineState,
  createHabit,
  createTag,
  createCategory,
  toggleHabitCompletion,
  setPref,
  deleteTag,
  deleteHabit,
  updateHabit,
  setHabitArchived,
  setCompletionNote,
  moveHabitInOrder,
  buildRoutineBackupPayload,
  applyRoutineBackupPayload,
  ROUTINE_EVENT,
} from "./lib/routineStorage.js";
import { completionNoteKey } from "./lib/completionNoteKey.js";
import { sortHabitsByOrder } from "./lib/habitOrder.js";
import { maxActiveStreak } from "./lib/streaks.js";
import { PushupsWidget } from "./components/PushupsWidget.jsx";
import { useRoutineReminders, requestRoutineNotificationPermission } from "./hooks/useRoutineReminders.js";
import {
  buildHubCalendarEvents,
  countEventsByDate,
  dateKeyFromDate,
  FIZRUK_GROUP_LABEL,
  parseDateKey,
} from "./lib/hubCalendarAggregate.js";

const FIZRUK_PLAN_SYNC = "fizruk-storage-monthly-plan";

/** Коралово-персиковий акцент модуля (узгоджено з «картками» Hub, не копія emerald Фізрука) */
const C = {
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

const MAIN_NAV = [
  {
    id: "calendar",
    label: "Календар",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    id: "settings",
    label: "Рутина",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
];

function todayDate() {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
}

function addDays(base, n) {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

function startOfIsoWeek(d) {
  const x = new Date(d);
  const wd = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - wd);
  x.setHours(12, 0, 0, 0);
  return x;
}

function monthBounds(y, m0) {
  const start = new Date(y, m0, 1);
  const end = new Date(y, m0 + 1, 0);
  return {
    startKey: dateKeyFromDate(start),
    endKey: dateKeyFromDate(end),
  };
}

function monthGrid(y, monthIndex) {
  const last = new Date(y, monthIndex + 1, 0).getDate();
  const firstWd = (new Date(y, monthIndex, 1).getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < firstWd; i++) cells.push(null);
  for (let d = 1; d <= last; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return { cells };
}

function useRoutineState() {
  const [state, setState] = useState(() => loadRoutineState());
  useEffect(() => {
    const sync = () => setState(loadRoutineState());
    window.addEventListener("storage", sync);
    window.addEventListener(ROUTINE_EVENT, sync);
    window.addEventListener(FIZRUK_PLAN_SYNC, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(ROUTINE_EVENT, sync);
      window.removeEventListener(FIZRUK_PLAN_SYNC, sync);
    };
  }, []);
  return [state, setState];
}

const TIME_MODES = [
  { id: "today", label: "Сьогодні" },
  { id: "tomorrow", label: "Завтра" },
  { id: "week", label: "Тиждень" },
  { id: "month", label: "Місяць" },
];

const RECURRENCE_OPTIONS = [
  { value: "daily", label: "Щодня" },
  { value: "weekdays", label: "Будні (пн–пт)" },
  { value: "weekly", label: "Обрані дні тижня" },
  { value: "monthly", label: "Щомісяця (число; лютий — останній день)" },
  { value: "once", label: "Одноразово (одна дата)" },
];

const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

function emptyHabitDraft() {
  const t = todayDate();
  return {
    name: "",
    emoji: "✓",
    tagIds: [],
    categoryId: null,
    recurrence: "daily",
    startDate: dateKeyFromDate(t),
    endDate: "",
    timeOfDay: "",
    weekdays: [0, 1, 2, 3, 4, 5, 6],
  };
}

function groupEventsForList(events) {
  const map = new Map();
  for (const e of events) {
    const head = e.fizruk ? FIZRUK_GROUP_LABEL : e.tagLabels[0] || "Інше";
    if (!map.has(head)) map.set(head, []);
    map.get(head).push(e);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "uk"));
}

export default function RoutineApp({ onBackToHub, onOpenModule } = {}) {
  const [routine, setRoutine] = useRoutineState();
  useRoutineReminders(routine);
  const [mainTab, setMainTab] = useState("calendar");
  const [timeMode, setTimeMode] = useState("today");
  const now = todayDate();
  const [monthCursor, setMonthCursor] = useState(() => ({ y: now.getFullYear(), m: now.getMonth() }));
  const [selectedDay, setSelectedDay] = useState(() => dateKeyFromDate(now));
  const [tagFilter, setTagFilter] = useState(null);
  const [listQuery, setListQuery] = useState("");
  const [habitDraft, setHabitDraft] = useState(emptyHabitDraft);
  const [tagDraft, setTagDraft] = useState("");
  const [catDraft, setCatDraft] = useState({ name: "", emoji: "" });

  useEffect(() => {
    const { startKey, endKey } = monthBounds(monthCursor.y, monthCursor.m);
    setSelectedDay((d) => (d < startKey || d > endKey ? startKey : d));
  }, [monthCursor.y, monthCursor.m]);

  const range = useMemo(() => {
    const t = todayDate();
    const tk = dateKeyFromDate(t);
    if (timeMode === "today") return { startKey: tk, endKey: tk };
    if (timeMode === "tomorrow") {
      const d = addDays(t, 1);
      const k = dateKeyFromDate(d);
      return { startKey: k, endKey: k };
    }
    if (timeMode === "week") {
      const s = startOfIsoWeek(t);
      const e = addDays(s, 6);
      return { startKey: dateKeyFromDate(s), endKey: dateKeyFromDate(e) };
    }
    return monthBounds(monthCursor.y, monthCursor.m);
  }, [timeMode, monthCursor.y, monthCursor.m]);

  const events = useMemo(
    () =>
      buildHubCalendarEvents(routine, range, {
        showFizruk: routine.prefs.showFizrukInCalendar !== false,
      }),
    [routine, range],
  );

  const filtered = useMemo(() => {
    let ev = events;
    if (tagFilter) {
      if (tagFilter === "__fizruk") ev = ev.filter((e) => e.fizruk);
      else ev = ev.filter((e) => e.tagLabels.includes(tagFilter));
    }
    const q = listQuery.trim().toLowerCase();
    if (q) {
      ev = ev.filter((e) => {
        const hay = `${e.title} ${e.subtitle} ${(e.tagLabels || []).join(" ")} ${e.note || ""}`.toLowerCase();
        return hay.includes(q);
      });
    }
    return ev;
  }, [events, tagFilter, listQuery]);

  const listEvents = useMemo(() => {
    if (timeMode === "month") return filtered.filter((e) => e.date === selectedDay);
    return filtered;
  }, [filtered, timeMode, selectedDay]);

  const grouped = useMemo(() => groupEventsForList(listEvents), [listEvents]);

  const tagChips = useMemo(() => {
    const set = new Set();
    for (const t of routine.tags) set.add(t.name);
    for (const e of events) {
      for (const x of e.tagLabels) {
        if (x !== FIZRUK_GROUP_LABEL) set.add(x);
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b, "uk"));
  }, [routine.tags, events]);

  const dayCounts = useMemo(() => countEventsByDate(events), [events]);

  const goMonth = (delta) => {
    setMonthCursor((c) => {
      let m = c.m + delta;
      let y = c.y;
      if (m > 11) {
        m = 0;
        y++;
      }
      if (m < 0) {
        m = 11;
        y--;
      }
      return { y, m };
    });
  };

  const goToToday = useCallback(() => {
    const t = todayDate();
    setMonthCursor({ y: t.getFullYear(), m: t.getMonth() });
    setSelectedDay(dateKeyFromDate(t));
  }, []);

  const onToggleHabit = useCallback(
    (habitId, dateKey) => {
      setRoutine((prev) => toggleHabitCompletion(prev, habitId, dateKey));
    },
    [setRoutine],
  );

  const monthTitle = new Date(monthCursor.y, monthCursor.m, 1).toLocaleDateString("uk-UA", {
    month: "long",
    year: "numeric",
  });

  const { cells } = monthGrid(monthCursor.y, monthCursor.m);

  const rangeLabel = useMemo(() => {
    if (timeMode === "today") return "Сьогодні";
    if (timeMode === "tomorrow") return "Завтра";
    if (timeMode === "week") return "Поточний тиждень";
    return monthTitle;
  }, [timeMode, monthTitle]);

  const headlineDate = todayDate().toLocaleDateString("uk-UA", { weekday: "long", day: "numeric", month: "long" });

  const todayKey = dateKeyFromDate(todayDate());
  const streakMax = useMemo(
    () => maxActiveStreak(routine.habits, routine.completions, todayKey),
    [routine.habits, routine.completions, todayKey],
  );

  return (
    <div className="h-dvh flex flex-col bg-bg text-text overflow-hidden">
      <div
        className="shrink-0 bg-panel/95 backdrop-blur-md border-b border-line/60 z-40 relative"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="flex min-h-[68px] items-center px-4 py-2 sm:px-5 gap-3">
          {typeof onBackToHub === "function" ? (
            <button
              type="button"
              onClick={onBackToHub}
              className="shrink-0 w-10 h-10 min-w-[40px] min-h-[40px] -ml-1 flex items-center justify-center rounded-xl text-muted hover:text-text hover:bg-panelHi transition-colors border border-line/80 bg-panel/80"
              aria-label="До вибору модуля"
              title="До хабу"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </button>
          ) : (
            <div className={cn("shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border", C.iconBox)} aria-hidden>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M8 14h.01M12 14h.01M16 14h.01" />
              </svg>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <span className={cn("text-[9px] font-bold tracking-widest uppercase block leading-none mb-0.5", C.eyebrow)}>
              Hub календар
            </span>
            <span className="text-[16px] font-semibold tracking-wide text-text block leading-tight">РУТИНА</span>
            <span className="text-[10px] text-subtle font-medium truncate">Звички · план Фізрука · один розклад</span>
          </div>
          <div className={cn("shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border", C.iconBox)} aria-hidden>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <main className="flex-1 overflow-y-auto routine-page-scroll-pad max-w-4xl mx-auto w-full px-4 pt-4 space-y-4">
          {mainTab === "calendar" && (
            <>
              <section className="routine-hero-card" aria-label="Огляд періоду">
                <p className="text-[11px] font-bold tracking-widest uppercase text-[#b45348]/90">{rangeLabel}</p>
                <p className="text-xs text-subtle mt-1">{headlineDate}</p>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-2xl bg-white/70 border border-[#f5c4b8]/50 p-3 text-center shadow-sm">
                    <p className="text-[10px] uppercase tracking-wide text-subtle">Подій у зрізі</p>
                    <p className="text-2xl font-black text-text tabular-nums mt-0.5">{filtered.length}</p>
                  </div>
                  <div className="rounded-2xl bg-white/70 border border-[#f5c4b8]/50 p-3 text-center shadow-sm">
                    <p className="text-[10px] uppercase tracking-wide text-subtle">Звичок активних</p>
                    <p className="text-2xl font-black text-text tabular-nums mt-0.5">
                      {routine.habits.filter((h) => !h.archived).length}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/70 border border-[#f5c4b8]/50 p-3 text-center shadow-sm">
                    <p className="text-[10px] uppercase tracking-wide text-subtle">Серія max</p>
                    <p className="text-2xl font-black text-text tabular-nums mt-0.5">{streakMax}</p>
                  </div>
                  <div className="rounded-2xl bg-white/70 border border-[#f5c4b8]/50 p-3 text-center shadow-sm">
                    <p className="text-[10px] uppercase tracking-wide text-subtle">Фізрук у стрічці</p>
                    <p className="text-sm font-semibold text-text mt-1.5">
                      {routine.prefs.showFizrukInCalendar !== false ? "Увімкнено" : "Вимкнено"}
                    </p>
                  </div>
                </div>
              </section>

              <PushupsWidget />

              <div className="flex flex-wrap gap-1.5">
                {TIME_MODES.map((tm) => (
                  <button
                    key={tm.id}
                    type="button"
                    onClick={() => setTimeMode(tm.id)}
                    className={cn(
                      "px-3 py-2 rounded-full text-xs font-semibold border transition-all",
                      timeMode === tm.id ? C.chipOn : C.chipOff,
                    )}
                  >
                    {tm.label}
                  </button>
                ))}
              </div>

              <Input
                className="!h-10 w-full max-w-md"
                placeholder="Пошук у стрічці…"
                value={listQuery}
                onChange={(e) => setListQuery(e.target.value)}
                aria-label="Пошук подій"
              />

              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-[10px] font-bold text-subtle uppercase tracking-widest w-full sm:w-auto">Теги</span>
                <button
                  type="button"
                  onClick={() => setTagFilter(null)}
                  className={cn("px-2.5 py-1.5 rounded-full text-[11px] font-medium border", tagFilter === null ? C.chipOn : C.chipOff)}
                >
                  Усі
                </button>
                {routine.prefs.showFizrukInCalendar !== false && (
                  <button
                    type="button"
                    onClick={() => setTagFilter((f) => (f === "__fizruk" ? null : "__fizruk"))}
                    className={cn(
                      "px-2.5 py-1.5 rounded-full text-[11px] font-medium border",
                      tagFilter === "__fizruk" ? "border-sky-400/50 bg-sky-500/10 text-text" : C.chipOff,
                    )}
                  >
                    {FIZRUK_GROUP_LABEL}
                  </button>
                )}
                {tagChips.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setTagFilter((f) => (f === name ? null : name))}
                    className={cn(
                      "px-2.5 py-1.5 rounded-full text-[11px] font-medium border max-w-[160px] truncate",
                      tagFilter === name ? C.chipOn : C.chipOff,
                    )}
                  >
                    {name}
                  </button>
                ))}
              </div>

              {timeMode === "month" && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      className="w-10 h-10 rounded-xl border border-line/80 bg-panel/90 text-muted hover:text-text shadow-sm"
                      onClick={() => goMonth(-1)}
                      aria-label="Попередній місяць"
                    >
                      ‹
                    </button>
                    <span className="text-sm font-semibold capitalize flex-1 text-center">{monthTitle}</span>
                    <button
                      type="button"
                      className="w-10 h-10 rounded-xl border border-line/80 bg-panel/90 text-muted hover:text-text shadow-sm"
                      onClick={() => goMonth(1)}
                      aria-label="Наступний місяць"
                    >
                      ›
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={goToToday}
                    className={cn(
                      "w-full min-h-[40px] rounded-xl text-xs font-semibold border transition-colors",
                      C.chipOn,
                    )}
                  >
                    Сьогодні
                  </button>
                </div>
              )}

              {timeMode === "month" && (
                <section className="bg-panel border border-line/60 rounded-2xl p-4 shadow-card">
                  <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-subtle mb-2">
                    {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"].map((d) => (
                      <div key={d}>{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {cells.map((day, i) => {
                      if (day == null) return <div key={`e-${i}`} className="aspect-square min-h-[40px]" />;
                      const key = `${monthCursor.y}-${String(monthCursor.m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                      const n = dayCounts.get(key) || 0;
                      const sel = selectedDay === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setSelectedDay(key)}
                          className={cn(
                            "aspect-square min-h-[40px] rounded-xl text-sm font-semibold flex flex-col items-center justify-center gap-0.5 transition-colors",
                            sel ? C.monthSel : "hover:bg-panelHi border border-transparent",
                          )}
                        >
                          <span>{day}</span>
                          {n > 0 && (
                            <span className="flex items-center gap-0.5">
                              <span className={cn("w-1.5 h-1.5 rounded-full", C.dot)} />
                              {n > 1 && <span className="text-[9px] text-subtle tabular-nums">{n}</span>}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-subtle mt-3 pt-3 border-t border-line/50">
                    Обрано:{" "}
                    {parseDateKey(selectedDay).toLocaleDateString("uk-UA", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </p>
                </section>
              )}

              <section className="space-y-4 pb-2">
                {grouped.length === 0 && (
                  <div className="rounded-2xl border border-line/60 bg-panel p-8 text-center shadow-card">
                    <p className="text-sm text-muted leading-relaxed">
                      Немає подій у цьому періоді. Додай звички в «Рутина» або заповни план у Фізруку.
                    </p>
                  </div>
                )}
                {grouped.map(([label, rows]) => (
                  <div key={label}>
                    <h3 className="text-xs font-bold text-subtle uppercase tracking-widest mb-2">{label}</h3>
                    <ul className="space-y-2">
                      {rows.map((e) => (
                        <li
                          key={e.id}
                          className={cn(
                            "rounded-2xl border border-line/60 bg-panel pl-3 pr-4 py-3 shadow-card flex flex-col gap-1 border-l-4",
                            e.fizruk ? "border-l-sky-500" : e.habitId ? "border-l-[#e0786c]" : "border-l-transparent",
                            e.completed && e.habitId && "opacity-90",
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold text-text text-[15px] leading-snug">{e.title}</p>
                              <p className="text-[11px] text-subtle mt-0.5">
                                {parseDateKey(e.date).toLocaleDateString("uk-UA", {
                                  weekday: "short",
                                  day: "numeric",
                                  month: "short",
                                })}{" "}
                                · {e.subtitle}
                              </p>
                            </div>
                            <div className="flex items-start gap-2 shrink-0">
                              {e.fizruk && typeof onOpenModule === "function" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="!h-9 !px-3 !text-xs border border-line/70 bg-panelHi/80"
                                  type="button"
                                  onClick={() => onOpenModule("fizruk", { hash: "plan" })}
                                >
                                  План
                                </Button>
                              )}
                              {e.habitId && (
                                <button
                                  type="button"
                                  onClick={() => onToggleHabit(e.habitId, e.date)}
                                  className={cn(
                                    "w-10 h-10 rounded-xl border flex items-center justify-center text-base font-bold transition-colors",
                                    e.completed ? C.done : "border-line hover:bg-panelHi text-muted",
                                  )}
                                  aria-label={e.completed ? "Скасувати виконання" : "Виконано"}
                                  title={e.completed ? "Скасувати" : "Виконано"}
                                >
                                  {e.completed ? "✓" : "○"}
                                </button>
                              )}
                            </div>
                          </div>
                          {e.habitId && e.completed && (
                            <Input
                              className="!h-9 !text-xs mt-1"
                              placeholder="Нотатка до відмітки"
                              value={routine.completionNotes?.[completionNoteKey(e.habitId, e.date)] || ""}
                              onChange={(ev) =>
                                setRoutine((s) => setCompletionNote(s, e.habitId, e.date, ev.target.value))
                              }
                            />
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            </>
          )}

          {mainTab === "settings" && (
            <SettingsSection
              routine={routine}
              setRoutine={setRoutine}
              habitDraft={habitDraft}
              setHabitDraft={setHabitDraft}
              tagDraft={tagDraft}
              setTagDraft={setTagDraft}
              catDraft={catDraft}
              setCatDraft={setCatDraft}
            />
          )}
        </main>
      </div>

      <nav
        className="shrink-0 bg-panel/95 backdrop-blur-md border-t border-line/60 relative z-30"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex h-[58px]">
          {MAIN_NAV.map((item) => {
            const active = mainTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setMainTab(item.id)}
                className={cn(
                  "relative flex-1 flex flex-col items-center justify-center gap-1 transition-all min-h-[48px]",
                  active ? "text-text" : "text-muted",
                )}
              >
                {active && <span className={cn("absolute top-0 left-1/2 -translate-x-1/2 w-9 h-0.5 rounded-full", C.navBar)} aria-hidden />}
                <span className={cn(active && C.navActive)}>{item.icon}</span>
                <span className={cn("text-[11px] leading-none font-semibold", active ? "text-text" : "text-muted")}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function habitDraftToPatch(draft) {
  const tagIds = draft.tagIds || [];
  return {
    name: draft.name.trim(),
    emoji: draft.emoji || "✓",
    tagIds,
    categoryId: draft.categoryId || null,
    recurrence: draft.recurrence || "daily",
    startDate: draft.startDate || dateKeyFromDate(todayDate()),
    endDate: draft.endDate && String(draft.endDate).trim() ? String(draft.endDate).trim() : null,
    timeOfDay: draft.timeOfDay && String(draft.timeOfDay).trim() ? String(draft.timeOfDay).trim().slice(0, 5) : "",
    weekdays: Array.isArray(draft.weekdays) ? draft.weekdays : [0, 1, 2, 3, 4, 5, 6],
  };
}

function SettingsSection({
  routine,
  setRoutine,
  habitDraft,
  setHabitDraft,
  tagDraft,
  setTagDraft,
  catDraft,
  setCatDraft,
}) {
  const [editingId, setEditingId] = useState(null);
  const backupRef = useRef(null);

  const loadHabitIntoDraft = (h) => {
    setHabitDraft({
      name: h.name || "",
      emoji: h.emoji || "✓",
      tagIds: h.tagIds || [],
      categoryId: h.categoryId || null,
      recurrence: h.recurrence || "daily",
      startDate: h.startDate || dateKeyFromDate(todayDate()),
      endDate: h.endDate || "",
      timeOfDay: h.timeOfDay || "",
      weekdays: Array.isArray(h.weekdays) && h.weekdays.length ? h.weekdays : [0, 1, 2, 3, 4, 5, 6],
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setHabitDraft(emptyHabitDraft());
  };

  const saveHabit = () => {
    const patch = habitDraftToPatch(habitDraft);
    if (!patch.name) return;
    if (patch.recurrence === "weekly" && (!patch.weekdays || patch.weekdays.length === 0)) {
      window.alert("Обери хоча б один день тижня.");
      return;
    }
    if (editingId) {
      setRoutine((s) => updateHabit(s, editingId, patch));
      cancelEdit();
    } else {
      setRoutine((s) => createHabit(s, patch));
      setHabitDraft(emptyHabitDraft());
    }
  };

  return (
    <div className="space-y-4 pb-4">
      <section className="bg-panel border border-line/60 rounded-2xl p-4 shadow-card space-y-3">
        <h2 className="text-xs font-bold text-subtle uppercase tracking-widest">Календар</h2>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted">Показувати тренування з Фізрука</span>
          <input
            type="checkbox"
            className="w-5 h-5 accent-[#e0786c]"
            checked={routine.prefs.showFizrukInCalendar !== false}
            onChange={(ev) => setRoutine((s) => setPref(s, "showFizrukInCalendar", ev.target.checked))}
          />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted">Нагадування в браузері</span>
          <input
            type="checkbox"
            className="w-5 h-5 accent-[#e0786c]"
            checked={routine.prefs.routineRemindersEnabled === true}
            onChange={async (ev) => {
              const on = ev.target.checked;
              if (on) {
                const p = await requestRoutineNotificationPermission();
                if (p !== "granted") {
                  window.alert(
                    "Без дозволу на сповіщення нагадування не надсилатимуться. Дозволь сповіщення для цього сайту в налаштуваннях браузера.",
                  );
                  return;
                }
              }
              setRoutine((s) => setPref(s, "routineRemindersEnabled", on));
            }}
          />
        </label>
        <p className="text-[10px] text-subtle leading-snug">
          У звичці вкажи «Час нагадування». Один раз на день о цій хвилині, якщо день запланований і ще немає відмітки. Працює, поки відкрита вкладка або дозволено тло (залежить від браузера).
        </p>
      </section>

      <section className="bg-panel border border-line/60 rounded-2xl p-4 shadow-card space-y-3">
        <h2 className="text-xs font-bold text-subtle uppercase tracking-widest">Резервна копія</h2>
        <p className="text-[10px] text-subtle">Звички, відмітки, відтискання та нотатки — один JSON-файл.</p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className={cn("font-bold", C.primary)}
            onClick={() => {
              const blob = new Blob([JSON.stringify(buildRoutineBackupPayload(), null, 2)], {
                type: "application/json",
              });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `hub-routine-backup-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              setTimeout(() => URL.revokeObjectURL(a.href), 1500);
            }}
          >
            Експорт JSON
          </Button>
          <Button type="button" variant="ghost" className="border border-line/70" onClick={() => backupRef.current?.click()}>
            Імпорт
          </Button>
          <input
            ref={backupRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                const text = await f.text();
                applyRoutineBackupPayload(JSON.parse(text));
                setRoutine(loadRoutineState());
              } catch (err) {
                window.alert(err?.message || "Не вдалося імпортувати файл.");
              }
              e.target.value = "";
            }}
          />
        </div>
      </section>

      <section className="bg-panel border border-line/60 rounded-2xl p-4 shadow-card space-y-3">
        <h2 className="text-xs font-bold text-subtle uppercase tracking-widest">
          {editingId ? "Редагувати звичку" : "Нова звичка"}
        </h2>
        <div className="flex gap-2">
          <Input
            className="!h-10 max-w-[4rem] text-center"
            value={habitDraft.emoji}
            onChange={(e) => setHabitDraft((d) => ({ ...d, emoji: e.target.value.slice(0, 4) }))}
            aria-label="Емодзі"
          />
          <Input
            className="!h-10 flex-1"
            placeholder="Назва"
            value={habitDraft.name}
            onChange={(e) => setHabitDraft((d) => ({ ...d, name: e.target.value }))}
          />
        </div>

        <label className="block text-xs text-subtle">
          Регулярність
          <select
            className="mt-1 w-full h-10 rounded-2xl border border-line bg-panelHi px-3 text-sm"
            value={habitDraft.recurrence || "daily"}
            onChange={(e) => setHabitDraft((d) => ({ ...d, recurrence: e.target.value }))}
          >
            {RECURRENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block text-xs text-subtle">
            Початок (дата)
            <Input
              type="date"
              className="mt-1 !h-10"
              value={habitDraft.startDate || ""}
              onChange={(e) => setHabitDraft((d) => ({ ...d, startDate: e.target.value }))}
            />
          </label>
          <label className="block text-xs text-subtle">
            Кінець (необовʼязково)
            <Input
              type="date"
              className="mt-1 !h-10"
              value={habitDraft.endDate || ""}
              onChange={(e) => setHabitDraft((d) => ({ ...d, endDate: e.target.value }))}
            />
          </label>
        </div>

        <label className="block text-xs text-subtle">
          Час нагадування (необовʼязково)
          <Input
            type="time"
            className="mt-1 !h-10"
            value={habitDraft.timeOfDay || ""}
            onChange={(e) => setHabitDraft((d) => ({ ...d, timeOfDay: e.target.value }))}
          />
        </label>

        {habitDraft.recurrence === "weekly" && (
          <div>
            <p className="text-xs text-subtle mb-2">Дні тижня</p>
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_LABELS.map((label, wd) => {
                const on = (habitDraft.weekdays || []).includes(wd);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      setHabitDraft((d) => {
                        const cur = [...(d.weekdays || [])];
                        const i = cur.indexOf(wd);
                        if (i >= 0) {
                          if (cur.length <= 1) return d;
                          cur.splice(i, 1);
                        } else cur.push(wd);
                        cur.sort((a, b) => a - b);
                        return { ...d, weekdays: cur };
                      });
                    }}
                    className={cn(
                      "min-h-[40px] px-3 rounded-xl text-xs font-semibold border transition-colors",
                      on ? C.chipOn : C.chipOff,
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {(habitDraft.recurrence === "once" || habitDraft.recurrence === "monthly") && (
          <p className="text-[11px] text-subtle leading-snug">
            {habitDraft.recurrence === "once"
              ? "Подія зʼявиться лише в день «Початок». Кінець можна залишити порожнім."
              : "Орієнтир — день місяця з «Початок». У коротких місяцях (наприклад 31 → лютий) — останній день місяця."}
          </p>
        )}

        {routine.tags.length > 0 && (
          <label className="block text-xs text-subtle">
            Тег
            <select
              className="mt-1 w-full h-10 rounded-2xl border border-line bg-panelHi px-3 text-sm"
              value={habitDraft.tagIds[0] || ""}
              onChange={(e) => {
                const id = e.target.value;
                setHabitDraft((d) => ({
                  ...d,
                  tagIds: id ? [id] : [],
                }));
              }}
            >
              <option value="">— без тегу —</option>
              {routine.tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {routine.categories.length > 0 && (
          <label className="block text-xs text-subtle">
            Категорія
            <select
              className="mt-1 w-full h-10 rounded-2xl border border-line bg-panelHi px-3 text-sm"
              value={habitDraft.categoryId || ""}
              onChange={(e) => {
                const id = e.target.value;
                setHabitDraft((d) => ({ ...d, categoryId: id || null }));
              }}
            >
              <option value="">— без категорії —</option>
              {routine.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji ? `${c.emoji} ` : ""}
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="flex flex-col gap-2">
          <Button type="button" className={cn("w-full font-bold", C.primary)} onClick={saveHabit}>
            {editingId ? "Зберегти зміни" : "Додати звичку"}
          </Button>
          {editingId && (
            <Button type="button" variant="ghost" className="w-full border border-line/70" onClick={cancelEdit}>
              Скасувати
            </Button>
          )}
        </div>
      </section>

      <section className="bg-panel border border-line/60 rounded-2xl p-4 shadow-card space-y-3">
        <h2 className="text-xs font-bold text-subtle uppercase tracking-widest">Теги</h2>
        <div className="flex gap-2">
          <Input className="!h-10 flex-1" placeholder="Новий тег" value={tagDraft} onChange={(e) => setTagDraft(e.target.value)} />
          <Button
            type="button"
            variant="ghost"
            className="shrink-0 border border-line/70"
            onClick={() => {
              setRoutine((s) => createTag(s, tagDraft));
              setTagDraft("");
            }}
          >
            +
          </Button>
        </div>
        <ul className="flex flex-wrap gap-2">
          {routine.tags.map((t) => (
            <li
              key={t.id}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-panelHi text-xs border border-line/50 font-medium"
            >
              {t.name}
              <button
                type="button"
                className="text-subtle hover:text-danger min-w-[28px] min-h-[28px] flex items-center justify-center rounded-lg"
                onClick={() => setRoutine((s) => deleteTag(s, t.id))}
                aria-label={`Видалити ${t.name}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-panel border border-line/60 rounded-2xl p-4 shadow-card space-y-3">
        <h2 className="text-xs font-bold text-subtle uppercase tracking-widest">Категорії</h2>
        <div className="flex gap-2 flex-wrap">
          <Input
            className="!h-10 max-w-[4rem]"
            placeholder="🏠"
            value={catDraft.emoji}
            onChange={(e) => setCatDraft((d) => ({ ...d, emoji: e.target.value }))}
          />
          <Input
            className="!h-10 flex-1 min-w-[120px]"
            placeholder="Назва категорії"
            value={catDraft.name}
            onChange={(e) => setCatDraft((d) => ({ ...d, name: e.target.value }))}
          />
          <Button type="button" variant="ghost" className="border border-line/70" onClick={() => {
            setRoutine((s) => createCategory(s, catDraft.name, catDraft.emoji));
            setCatDraft({ name: "", emoji: "" });
          }}
          >
            Додати
          </Button>
        </div>
      </section>

      <section className="bg-panel border border-line/60 rounded-2xl p-4 shadow-card space-y-2">
        <h2 className="text-xs font-bold text-subtle uppercase tracking-widest">Активні звички</h2>
        {routine.habits.filter((h) => !h.archived).length === 0 && (
          <p className="text-xs text-muted">Поки порожньо — додай першу звичку вище.</p>
        )}
        <ul className="space-y-2">
          {sortHabitsByOrder(
            routine.habits.filter((h) => !h.archived),
            routine.habitOrder || [],
          ).map((h) => {
              const recLabel = RECURRENCE_OPTIONS.find((o) => o.value === (h.recurrence || "daily"))?.label || "";
              return (
                <li
                  key={h.id}
                  className={cn(
                    "flex flex-col gap-2 border-b border-line/40 pb-3 last:border-0 last:pb-0",
                    editingId === h.id && "ring-2 ring-[#f0a090]/60 rounded-xl p-2 -mx-1",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-sm font-medium">
                        {h.emoji} {h.name}
                      </span>
                      <p className="text-[10px] text-subtle mt-0.5">
                        {recLabel}
                        {h.timeOfDay ? ` · ${h.timeOfDay}` : ""}
                        {h.startDate ? ` · з ${h.startDate}` : ""}
                        {h.endDate ? ` до ${h.endDate}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 justify-end shrink-0 max-w-[min(100%,12rem)] sm:max-w-none">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className="min-w-[32px] min-h-[36px] rounded-lg border border-line/70 text-xs text-muted hover:text-text"
                          onClick={() => setRoutine((s) => moveHabitInOrder(s, h.id, -1))}
                          aria-label="Вгору в списку"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="min-w-[32px] min-h-[36px] rounded-lg border border-line/70 text-xs text-muted hover:text-text"
                          onClick={() => setRoutine((s) => moveHabitInOrder(s, h.id, 1))}
                          aria-label="Вниз в списку"
                        >
                          ↓
                        </button>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="!h-9 !px-3 !text-xs border border-line/70"
                        onClick={() => {
                          setEditingId(h.id);
                          loadHabitIntoDraft(h);
                        }}
                      >
                        Змінити
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="!h-9 !px-3 !text-xs border border-line/70"
                        onClick={() => {
                          setRoutine((s) => setHabitArchived(s, h.id, true));
                          if (editingId === h.id) cancelEdit();
                        }}
                      >
                        В архів
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="!h-9 !px-3 !text-xs text-danger border border-danger/25"
                        onClick={() => {
                          if (window.confirm(`Видалити звичку «${h.name}»? Відмітки по днях теж зникнуть.`)) {
                            setRoutine((s) => deleteHabit(s, h.id));
                            if (editingId === h.id) cancelEdit();
                          }
                        }}
                      >
                        Видалити
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
        </ul>
      </section>

      {routine.habits.some((h) => h.archived) && (
        <section className="bg-panel border border-line/60 rounded-2xl p-4 shadow-card space-y-2 opacity-95">
          <h2 className="text-xs font-bold text-subtle uppercase tracking-widest">Архів</h2>
          <p className="text-[10px] text-subtle">Не показуються в календарі; відмітки збережені.</p>
          <ul className="space-y-2">
            {routine.habits
              .filter((h) => h.archived)
              .map((h) => (
                <li
                  key={h.id}
                  className="flex flex-col gap-2 border-b border-line/40 pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="text-sm text-muted">
                    {h.emoji} {h.name}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="!h-9 !px-3 !text-xs border border-line/70"
                      onClick={() => setRoutine((s) => setHabitArchived(s, h.id, false))}
                    >
                      Відновити
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="!h-9 !px-3 !text-xs text-danger border border-danger/25"
                      onClick={() => {
                        if (window.confirm(`Видалити «${h.name}» назавжди?`)) {
                          setRoutine((s) => deleteHabit(s, h.id));
                        }
                      }}
                    >
                      Видалити
                    </Button>
                  </div>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}
