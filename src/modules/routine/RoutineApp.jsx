import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@shared/lib/cn";
import {
  loadRoutineState,
  toggleHabitCompletion,
  markAllScheduledHabitsComplete,
  ROUTINE_EVENT,
  ROUTINE_STORAGE_ERROR,
} from "./lib/routineStorage.js";
import { addDays, startOfIsoWeek } from "./lib/weekUtils.js";
import { maxActiveStreak } from "./lib/streaks.js";
import { useRoutineReminders } from "./hooks/useRoutineReminders.js";
import {
  buildHubCalendarEvents,
  countEventsByDate,
  dateKeyFromDate,
  FIZRUK_GROUP_LABEL,
  parseDateKey,
  habitScheduledOnDate,
} from "./lib/hubCalendarAggregate.js";
import { FINYK_SUB_GROUP_LABEL } from "./lib/finykSubscriptionCalendar.js";
import {
  HUB_FINYK_ROUTINE_SYNC_EVENT,
  HUB_FINYK_TX_CACHE_EVENT,
} from "../finyk/hubRoutineSync.js";
import { ROUTINE_THEME as C } from "./lib/routineConstants.js";
import { emptyHabitDraft } from "./lib/routineDraftUtils.js";
import { RoutineBottomNav } from "./components/RoutineBottomNav.jsx";
import { RoutineCalendarPanel } from "./components/RoutineCalendarPanel.jsx";
import { RoutineSettingsSection } from "./components/RoutineSettingsSection.jsx";

const FIZRUK_PLAN_SYNC = "fizruk-storage-monthly-plan";

function todayDate() {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
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

function groupEventsForList(events) {
  const map = new Map();
  for (const e of events) {
    const head = e.fizruk
      ? FIZRUK_GROUP_LABEL
      : e.finykSub
        ? FINYK_SUB_GROUP_LABEL
        : e.tagLabels[0] || "Інше";
    if (!map.has(head)) map.set(head, []);
    map.get(head).push(e);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "uk"));
}

function RoutineStorageToast({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div
      className="fixed top-[max(4.5rem,env(safe-area-inset-top,0px)+3.5rem)] left-1/2 -translate-x-1/2 z-[80] max-w-[min(92vw,24rem)] px-4 py-3 rounded-2xl text-sm font-medium shadow-lg bg-danger/95 text-white"
      role="alert"
    >
      <div className="flex gap-3 items-start">
        <p className="min-w-0 flex-1 leading-snug">{message}</p>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-white/90 hover:text-white text-xs font-bold uppercase tracking-wide"
        >
          OK
        </button>
      </div>
    </div>
  );
}

export default function RoutineApp({ onBackToHub, onOpenModule } = {}) {
  const [routine, setRoutine] = useRoutineState();
  const [storageErrorToast, setStorageErrorToast] = useState(null);
  const [finykCalendarTick, setFinykCalendarTick] = useState(0);
  useEffect(() => {
    const bump = () => setFinykCalendarTick((n) => n + 1);
    window.addEventListener(HUB_FINYK_ROUTINE_SYNC_EVENT, bump);
    window.addEventListener(HUB_FINYK_TX_CACHE_EVENT, bump);
    return () => {
      window.removeEventListener(HUB_FINYK_ROUTINE_SYNC_EVENT, bump);
      window.removeEventListener(HUB_FINYK_TX_CACHE_EVENT, bump);
    };
  }, []);

  useEffect(() => {
    const onErr = (ev) => {
      const msg = ev.detail?.message || "невідома помилка";
      setStorageErrorToast(
        `Не вдалося зберегти дані Рутини (${msg}). Можливо, браузер переповнив сховище — звільни місце або експортуй резервну копію в розділі «Рутина».`,
      );
    };
    window.addEventListener(ROUTINE_STORAGE_ERROR, onErr);
    return () => window.removeEventListener(ROUTINE_STORAGE_ERROR, onErr);
  }, []);

  useEffect(() => {
    if (!storageErrorToast) return undefined;
    const t = window.setTimeout(() => setStorageErrorToast(null), 7000);
    return () => window.clearTimeout(t);
  }, [storageErrorToast]);

  useRoutineReminders(routine);

  const [mainTab, setMainTab] = useState("calendar");
  const [timeMode, setTimeMode] = useState("today");
  const now = todayDate();
  const [monthCursor, setMonthCursor] = useState(() => ({
    y: now.getFullYear(),
    m: now.getMonth(),
  }));
  const [selectedDay, setSelectedDay] = useState(() => dateKeyFromDate(now));
  const [tagFilter, setTagFilter] = useState(null);
  const [listQuery, setListQuery] = useState("");
  const [habitDraft, setHabitDraft] = useState(emptyHabitDraft);
  const [tagDraft, setTagDraft] = useState("");
  const [catDraft, setCatDraft] = useState({ name: "", emoji: "" });

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get("routineDay");
      if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) {
        setSelectedDay(q);
        setTimeMode("day");
      }
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    if (timeMode !== "month") return;
    const { startKey, endKey } = monthBounds(monthCursor.y, monthCursor.m);
    setSelectedDay((d) => (d < startKey || d > endKey ? startKey : d));
  }, [monthCursor.y, monthCursor.m, timeMode]);

  const range = useMemo(() => {
    const t = todayDate();
    const tk = dateKeyFromDate(t);
    if (timeMode === "today") return { startKey: tk, endKey: tk };
    if (timeMode === "tomorrow") {
      const d = addDays(t, 1);
      const k = dateKeyFromDate(d);
      return { startKey: k, endKey: k };
    }
    if (timeMode === "day") {
      return { startKey: selectedDay, endKey: selectedDay };
    }
    if (timeMode === "week") {
      const anchor = parseDateKey(selectedDay);
      const s = startOfIsoWeek(anchor);
      const e = addDays(s, 6);
      return { startKey: dateKeyFromDate(s), endKey: dateKeyFromDate(e) };
    }
    return monthBounds(monthCursor.y, monthCursor.m);
  }, [timeMode, monthCursor.y, monthCursor.m, selectedDay]);

  const events = useMemo(
    () =>
      buildHubCalendarEvents(routine, range, {
        showFizruk: routine.prefs.showFizrukInCalendar !== false,
        showFinykSubs: routine.prefs.showFinykSubscriptionsInCalendar !== false,
      }),
    /* finykCalendarTick лишаємо: оновлення подій Фініка без зміни routine */
    [routine, range, finykCalendarTick], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const filtered = useMemo(() => {
    let ev = events;
    if (tagFilter) {
      if (tagFilter === "__fizruk") ev = ev.filter((e) => e.fizruk);
      else if (tagFilter === "__finyk_sub") ev = ev.filter((e) => e.finykSub);
      else ev = ev.filter((e) => e.tagLabels.includes(tagFilter));
    }
    const q = listQuery.trim().toLowerCase();
    if (q) {
      ev = ev.filter((e) => {
        const hay =
          `${e.title} ${e.subtitle} ${(e.tagLabels || []).join(" ")} ${e.note || ""}`.toLowerCase();
        return hay.includes(q);
      });
    }
    return ev;
  }, [events, tagFilter, listQuery]);

  const listEvents = useMemo(() => {
    if (timeMode === "month")
      return filtered.filter((e) => e.date === selectedDay);
    return filtered;
  }, [filtered, timeMode, selectedDay]);

  const grouped = useMemo(() => groupEventsForList(listEvents), [listEvents]);

  const tagChips = useMemo(() => {
    const set = new Set();
    for (const t of routine.tags) set.add(t.name);
    for (const e of events) {
      for (const x of e.tagLabels) {
        if (x !== FIZRUK_GROUP_LABEL && x !== FINYK_SUB_GROUP_LABEL) set.add(x);
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

  const applyTimeMode = useCallback((id) => {
    const t = todayDate();
    const tk = dateKeyFromDate(t);
    if (id === "today") {
      setSelectedDay(tk);
      setTimeMode("today");
    } else if (id === "tomorrow") {
      setSelectedDay(dateKeyFromDate(addDays(t, 1)));
      setTimeMode("tomorrow");
    } else if (id === "week") {
      setSelectedDay(tk);
      setTimeMode("week");
    } else if (id === "month") {
      setMonthCursor({ y: t.getFullYear(), m: t.getMonth() });
      setSelectedDay(tk);
      setTimeMode("month");
    }
  }, []);

  const shiftWeekStrip = useCallback((deltaWeeks) => {
    setSelectedDay((prev) => {
      const d = parseDateKey(prev);
      d.setDate(d.getDate() + 7 * deltaWeeks);
      return dateKeyFromDate(d);
    });
    setTimeMode("day");
  }, []);

  const onToggleHabit = useCallback(
    (habitId, dateKey) => {
      setRoutine((prev) => toggleHabitCompletion(prev, habitId, dateKey));
    },
    [setRoutine],
  );

  const onBulkMarkDay = useCallback(() => {
    const dk = range.startKey;
    if (range.startKey !== range.endKey) return;
    setRoutine((s) => markAllScheduledHabitsComplete(s, dk));
  }, [range.startKey, range.endKey, setRoutine]);

  const canBulkMark = useMemo(() => {
    if (range.startKey !== range.endKey) return false;
    const dk = range.startKey;
    for (const h of routine.habits) {
      if (h.archived) continue;
      if (!habitScheduledOnDate(h, dk)) continue;
      if (!(routine.completions[h.id] || []).includes(dk)) return true;
    }
    return false;
  }, [range.startKey, range.endKey, routine.habits, routine.completions]);

  const monthTitle = new Date(
    monthCursor.y,
    monthCursor.m,
    1,
  ).toLocaleDateString("uk-UA", {
    month: "long",
    year: "numeric",
  });

  const { cells } = monthGrid(monthCursor.y, monthCursor.m);

  const rangeLabel = useMemo(() => {
    if (timeMode === "today") return "Сьогодні";
    if (timeMode === "tomorrow") return "Завтра";
    if (timeMode === "day") {
      return parseDateKey(selectedDay).toLocaleDateString("uk-UA", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
    }
    if (timeMode === "week") return "Цей тиждень";
    return monthTitle;
  }, [timeMode, monthTitle, selectedDay]);

  const fmtUk = (key) =>
    parseDateKey(key).toLocaleDateString("uk-UA", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });

  const headlineDate = useMemo(() => {
    const t0 = todayDate();
    const tk = dateKeyFromDate(t0);
    if (timeMode === "day") return fmtUk(selectedDay);
    if (timeMode === "today") return fmtUk(tk);
    if (timeMode === "tomorrow") return fmtUk(dateKeyFromDate(addDays(t0, 1)));
    if (timeMode === "week") {
      const a = fmtUk(range.startKey);
      const b = fmtUk(range.endKey);
      return range.startKey === range.endKey ? a : `${a} — ${b}`;
    }
    if (timeMode === "month") return fmtUk(selectedDay);
    return fmtUk(tk);
  }, [timeMode, selectedDay, range.startKey, range.endKey]);

  const todayKey = dateKeyFromDate(todayDate());
  const streakMax = useMemo(
    () => maxActiveStreak(routine.habits, routine.completions, todayKey),
    [routine.habits, routine.completions, todayKey],
  );

  const activeHabitsCount = routine.habits.filter((h) => !h.archived).length;
  const hasNoHabits = activeHabitsCount === 0;
  const hasListFilter = Boolean(tagFilter) || listQuery.trim().length > 0;
  const listIsEmpty = grouped.length === 0;

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
                "shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border",
                C.iconBox,
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
                aria-hidden
              >
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M8 14h.01M12 14h.01M16 14h.01" />
              </svg>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <span
              className={cn(
                "text-[9px] font-bold tracking-widest uppercase block leading-none mb-0.5",
                C.eyebrow,
              )}
            >
              Hub календар
            </span>
            <span className="text-[16px] font-semibold tracking-wide text-text block leading-tight">
              РУТИНА
            </span>
            <span className="text-[10px] text-subtle font-medium truncate">
              Звички · план Фізрука · один розклад
            </span>
          </div>
          <button
            type="button"
            onClick={() => applyTimeMode("today")}
            className={cn(
              "shrink-0 min-h-[40px] px-3 rounded-xl text-xs font-bold border transition-colors",
              C.chipOn,
            )}
            title="Перейти до сьогоднішнього дня"
            aria-label="Перейти на сьогоднішній день"
          >
            Сьогодні
          </button>
        </div>
      </div>

      <RoutineStorageToast
        message={storageErrorToast}
        onDismiss={() => setStorageErrorToast(null)}
      />

      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <main
          id="routine-main"
          className="flex-1 overflow-y-auto routine-page-scroll-pad routine-main-pad max-w-4xl mx-auto w-full pt-4 space-y-4"
          tabIndex={-1}
        >
          <RoutineCalendarPanel
            rangeLabel={rangeLabel}
            headlineDate={headlineDate}
            filtered={filtered}
            routine={routine}
            streakMax={streakMax}
            timeMode={timeMode}
            applyTimeMode={applyTimeMode}
            selectedDay={selectedDay}
            todayKey={todayKey}
            shiftWeekStrip={shiftWeekStrip}
            setSelectedDay={setSelectedDay}
            setTimeMode={setTimeMode}
            listQuery={listQuery}
            setListQuery={setListQuery}
            tagFilter={tagFilter}
            setTagFilter={setTagFilter}
            tagChips={tagChips}
            monthCursor={monthCursor}
            monthTitle={monthTitle}
            goMonth={goMonth}
            goToToday={goToToday}
            cells={cells}
            dayCounts={dayCounts}
            listIsEmpty={listIsEmpty}
            hasListFilter={hasListFilter}
            hasNoHabits={hasNoHabits}
            grouped={grouped}
            onToggleHabit={onToggleHabit}
            setRoutine={setRoutine}
            setMainTab={setMainTab}
            onOpenModule={onOpenModule}
            canBulkMark={canBulkMark}
            onBulkMarkDay={onBulkMarkDay}
            hidden={mainTab !== "calendar"}
          />

          <RoutineSettingsSection
            routine={routine}
            setRoutine={setRoutine}
            habitDraft={habitDraft}
            setHabitDraft={setHabitDraft}
            tagDraft={tagDraft}
            setTagDraft={setTagDraft}
            catDraft={catDraft}
            setCatDraft={setCatDraft}
            onOpenCalendar={() => setMainTab("calendar")}
            hidden={mainTab !== "settings"}
          />
        </main>
      </div>

      <RoutineBottomNav mainTab={mainTab} onSelectTab={setMainTab} />
    </div>
  );
}
