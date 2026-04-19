import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Virtuoso } from "react-virtuoso";
import { cn } from "@shared/lib/cn";
import { SectionHeading } from "@shared/components/ui/SectionHeading";
import { Button } from "@shared/components/ui/Button";
import { Card } from "@shared/components/ui/Card";
import { Input } from "@shared/components/ui/Input";
import { Segmented } from "@shared/components/ui/Segmented";
import { WeekDayStrip } from "./WeekDayStrip";
import { HabitDetailSheet } from "./HabitDetailSheet";
import { SwipeToAction } from "@shared/components/ui/SwipeToAction";
import { completionNoteKey } from "../lib/completionNoteKey.js";
import { DayProgressRing } from "./DayProgressRing";
import { DayReportSheet } from "./DayReportSheet";
import {
  FIZRUK_GROUP_LABEL,
  parseDateKey,
  habitScheduledOnDate,
} from "../lib/hubCalendarAggregate.js";
import {
  ROUTINE_THEME as C,
  ROUTINE_TIME_MODES as TIME_MODES,
  type RoutineTimeModeId,
} from "../lib/routineConstants.js";
import { setCompletionNote } from "../lib/routineStorage.js";
import {
  useRoutineCalendarActions,
  useRoutineCalendarData,
} from "../context/RoutineCalendarContext";
import type { HubCalendarEvent } from "../lib/types";

type GroupedListItem =
  | { kind: "header"; label: string }
  | { kind: "event"; e: HubCalendarEvent };

const timeModeItems: ReadonlyArray<{
  value: RoutineTimeModeId;
  label: string;
}> = TIME_MODES.map((tm) => ({ value: tm.id, label: tm.label }));

export interface RoutineCalendarPanelProps {
  hidden?: boolean;
}

export function RoutineCalendarPanel({
  hidden: panelHidden,
}: RoutineCalendarPanelProps) {
  const {
    rangeLabel,
    headlineDate,
    filtered,
    routine,
    currentStreak,
    completionRate,
    dayProgress,
    timeMode,
    selectedDay,
    todayKey,
    shiftWeekStrip,
    setSelectedDay,
    setTimeMode,
    listQuery,
    setListQuery,
    tagFilter,
    setTagFilter,
    tagChips,
    monthCursor,
    monthTitle,
    goMonth,
    goToToday,
    cells,
    dayCounts,
    listIsEmpty,
    hasListFilter,
    hasNoHabits,
    grouped,
    canBulkMark,
  } = useRoutineCalendarData();

  const {
    applyTimeMode,
    onToggleHabit,
    setRoutine,
    setMainTab,
    onOpenModule,
    onBulkMarkDay,
  } = useRoutineCalendarActions();
  const [listQueryDraft, setListQueryDraft] = useState(listQuery || "");
  useEffect(() => {
    setListQueryDraft(listQuery || "");
  }, [listQuery]);
  useEffect(() => {
    const id = setTimeout(() => setListQuery(listQueryDraft), 200);
    return () => clearTimeout(id);
  }, [listQueryDraft, setListQuery]);
  const [dayReportOpen, setDayReportOpen] = useState(false);
  const [detailHabitId, setDetailHabitId] = useState<string | null>(null);

  const flatGroupedItems = useMemo<GroupedListItem[]>(() => {
    const items: GroupedListItem[] = [];
    for (const [label, rows] of grouped || []) {
      items.push({ kind: "header", label });
      for (const e of rows || []) items.push({ kind: "event", e });
    }
    return items;
  }, [grouped]);

  const scheduledHabitsForReport = routine.habits
    .filter((h) => !h.archived && habitScheduledOnDate(h, todayKey))
    .map((h) => ({
      ...h,
      completed: (routine.completions[h.id] || []).includes(todayKey),
    }));

  const dayLabel = parseDateKey(todayKey).toLocaleDateString("uk-UA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return (
    <div
      role="tabpanel"
      id="routine-panel-calendar"
      aria-labelledby="routine-tab-calendar"
      hidden={panelHidden}
      className="space-y-4"
    >
      <Card
        as="section"
        variant="routine"
        padding="lg"
        aria-label="Огляд періоду"
      >
        <p
          className={cn(
            "text-xs font-bold tracking-widest uppercase",
            C.heroKicker,
          )}
        >
          {rangeLabel}
        </p>
        <p className="text-xs text-subtle mt-1">{headlineDate}</p>
        <div className="mt-4 flex flex-col sm:flex-row items-center gap-4">
          <DayProgressRing
            completed={dayProgress.completed}
            scheduled={dayProgress.scheduled}
            onClick={() => setDayReportOpen(true)}
          />
          <div className="flex-1 grid grid-cols-2 gap-2 w-full sm:grid-cols-2 lg:grid-cols-4">
            <div className={C.statCard}>
              <p className="text-2xs uppercase tracking-wide text-subtle">
                Подій у зрізі
              </p>
              <p className="text-2xl font-black text-text tabular-nums mt-0.5">
                {filtered.length}
              </p>
            </div>
            <div className={C.statCard}>
              <p className="text-2xs uppercase tracking-wide text-subtle">
                Звичок активних
              </p>
              <p className="text-2xl font-black text-text tabular-nums mt-0.5">
                {routine.habits.filter((h) => !h.archived).length}
              </p>
            </div>
            <div className={C.statCard}>
              <p className="text-2xs uppercase tracking-wide text-subtle">
                Виконання
              </p>
              <p className="text-2xl font-black text-text tabular-nums mt-0.5">
                {Math.round(completionRate.rate * 100)}%
              </p>
              <p className="text-3xs text-subtle tabular-nums">
                {completionRate.completed}/{completionRate.scheduled}
              </p>
            </div>
            <div className={C.statCard}>
              <p className="text-2xs uppercase tracking-wide text-subtle">
                Поточна серія
              </p>
              <p className="text-2xl font-black text-text tabular-nums mt-0.5">
                {currentStreak}
              </p>
            </div>
          </div>
        </div>
      </Card>

      <DayReportSheet
        open={dayReportOpen}
        onClose={() => setDayReportOpen(false)}
        dayLabel={dayLabel}
        scheduledHabits={scheduledHabitsForReport}
        onToggleHabit={onToggleHabit}
        dateKey={todayKey}
      />

      {canBulkMark && (
        <div className="flex justify-center">
          <Button
            type="button"
            className={cn("w-full max-w-md font-bold", C.primary)}
            onClick={onBulkMarkDay}
          >
            Відмітити всі звички на цей день
          </Button>
        </div>
      )}

      <Segmented
        tone="soft"
        size="sm"
        accent="routine"
        ariaLabel="Часовий діапазон"
        items={timeModeItems}
        value={timeMode}
        onChange={applyTimeMode}
      />

      <div className="rounded-2xl border border-line bg-panel/80 p-3 shadow-card">
        <SectionHeading as="p" size="xs" className="mb-2">
          Тиждень
        </SectionHeading>
        <WeekDayStrip
          anchorKey={selectedDay}
          selectedDay={selectedDay}
          todayKey={todayKey}
          onSelectDay={(k) => {
            setSelectedDay(k);
            setTimeMode("day");
          }}
          onShiftWeek={shiftWeekStrip}
        />
        {timeMode === "day" && (
          <p className="mt-2 text-center text-2xs text-subtle">
            Обрано один день — натисни «Сьогодні» або «Тиждень», щоб повернути
            зріз
          </p>
        )}
      </div>

      <Input
        className="routine-touch-field w-full max-w-md"
        placeholder="Пошук у стрічці…"
        value={listQueryDraft}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          setListQueryDraft(e.target.value)
        }
        aria-label="Пошук подій"
      />

      <div className="flex flex-wrap gap-1.5 items-center">
        <SectionHeading as="span" size="xs" className="w-full sm:w-auto">
          Теги
        </SectionHeading>
        <button
          type="button"
          onClick={() => setTagFilter(null)}
          className={cn(
            "px-2.5 py-1.5 rounded-full text-xs font-medium border",
            tagFilter === null ? C.chipOn : C.chipOff,
          )}
        >
          Усі
        </button>
        {routine.prefs.showFizrukInCalendar !== false && (
          <button
            type="button"
            onClick={() =>
              setTagFilter((f) => (f === "__fizruk" ? null : "__fizruk"))
            }
            className={cn(
              "px-2.5 py-1.5 rounded-full text-xs font-medium border",
              tagFilter === "__fizruk"
                ? "border-sky-400/50 bg-sky-500/10 text-text"
                : C.chipOff,
            )}
          >
            {FIZRUK_GROUP_LABEL}
          </button>
        )}
        {routine.prefs.showFinykSubscriptionsInCalendar !== false && (
          <button
            type="button"
            onClick={() =>
              setTagFilter((f) => (f === "__finyk_sub" ? null : "__finyk_sub"))
            }
            className={cn(
              "px-2.5 py-1.5 rounded-full text-xs font-medium border max-w-[200px] truncate",
              tagFilter === "__finyk_sub"
                ? "border-emerald-500/40 bg-emerald-500/10 text-text"
                : C.chipOff,
            )}
          >
            Підписки Фініка
          </button>
        )}
        {tagChips.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setTagFilter((f) => (f === name ? null : name))}
            className={cn(
              "px-2.5 py-1.5 rounded-full text-xs font-medium border max-w-[160px] truncate",
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
              className="w-10 h-10 rounded-xl border border-line bg-panel/90 text-muted hover:text-text shadow-sm"
              onClick={() => goMonth(-1)}
              aria-label="Попередній місяць"
            >
              ‹
            </button>
            <span className="text-sm font-semibold capitalize flex-1 text-center">
              {monthTitle}
            </span>
            <button
              type="button"
              className="w-10 h-10 rounded-xl border border-line bg-panel/90 text-muted hover:text-text shadow-sm"
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
        <Card as="section" radius="lg" padding="md">
          <div className="grid grid-cols-7 gap-1 text-center text-2xs font-semibold text-subtle mb-2">
            {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (day == null)
                return (
                  <div key={`e-${i}`} className="aspect-square min-h-[40px]" />
                );
              const key = `${monthCursor.y}-${String(monthCursor.m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const n = dayCounts.get(key) || 0;
              const sel = selectedDay === key;
              const label = parseDateKey(key).toLocaleDateString("uk-UA", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              });
              const aria =
                n > 0
                  ? `${label}, подій: ${n}${sel ? ", обрано" : ""}`
                  : `${label}${sel ? ", обрано" : ""}`;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDay(key)}
                  aria-label={aria}
                  aria-pressed={sel}
                  className={cn(
                    "aspect-square min-h-[40px] rounded-xl text-sm font-semibold flex flex-col items-center justify-center gap-0.5 transition-colors",
                    sel
                      ? C.monthSel
                      : "hover:bg-panelHi border border-transparent",
                  )}
                >
                  <span aria-hidden>{day}</span>
                  {n > 0 && (
                    <span className="flex items-center gap-0.5" aria-hidden>
                      <span className={cn("w-1.5 h-1.5 rounded-full", C.dot)} />
                      {n > 1 && (
                        <span className="text-3xs text-subtle tabular-nums">
                          {n}
                        </span>
                      )}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-subtle mt-3 pt-3 border-t border-line">
            Обрано:{" "}
            {parseDateKey(selectedDay).toLocaleDateString("uk-UA", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
        </Card>
      )}

      <section className="space-y-4 pb-2">
        {listIsEmpty && hasListFilter && (
          <div className="rounded-2xl border border-line bg-panel p-6 text-center shadow-card">
            <p className="text-sm text-muted">
              Нічого не знайдено за фільтром
              {hasNoHabits ? " (і звичок ще немає)" : ""}.
            </p>
            <Button
              type="button"
              variant="ghost"
              className="mt-3 border border-line"
              onClick={() => {
                setTagFilter(null);
                setListQuery("");
              }}
            >
              Скинути фільтри
            </Button>
          </div>
        )}
        {listIsEmpty && !hasListFilter && hasNoHabits && (
          <div className={C.emptyStateWarm}>
            <p className="text-base font-semibold text-text">
              Почни з однієї звички
            </p>
            <p className="mt-2 text-sm text-muted leading-relaxed">
              Потім вона зʼявиться тут і в календарі. Відтискання вже можна
              лічити блоком вище.
            </p>
            <Button
              type="button"
              className={cn("mt-4 w-full max-w-xs font-bold", C.primary)}
              onClick={() => setMainTab("settings")}
            >
              Додати звичку в «Рутина»
            </Button>
          </div>
        )}
        {listIsEmpty && !hasListFilter && !hasNoHabits && (
          <div className="rounded-2xl border border-line bg-panel p-6 text-center shadow-card">
            <p className="text-sm text-muted leading-relaxed">
              У цьому періоді подій немає. Перевір регулярність звичок або{" "}
              {typeof onOpenModule === "function" ? (
                <button
                  type="button"
                  className={C.linkAccent}
                  onClick={() => onOpenModule("fizruk", { hash: "plan" })}
                >
                  план Фізрука
                </button>
              ) : (
                "план Фізрука"
              )}
              .
            </p>
          </div>
        )}
        {flatGroupedItems.length > 0 && (
          <Virtuoso<GroupedListItem>
            data={flatGroupedItems}
            computeItemKey={(_, item) =>
              item.kind === "header" ? `h_${item.label}` : `e_${item.e?.id}`
            }
            itemContent={(_, item) => {
              if (item.kind === "header") {
                return (
                  <SectionHeading as="h3" size="sm" className="mb-2 mt-3">
                    {item.label}
                  </SectionHeading>
                );
              }
              const e = item.e;
              return (
                <div className="mb-2">
                  <SwipeToAction
                    onSwipeRight={
                      e.habitId && !e.completed
                        ? () => onToggleHabit(e.habitId, e.date)
                        : undefined
                    }
                    onSwipeLeft={
                      e.habitId && e.completed
                        ? () => onToggleHabit(e.habitId, e.date)
                        : undefined
                    }
                    leftLabel="✓ Виконано"
                    leftColor="bg-success"
                    rightLabel="↩ Скасувати"
                    rightColor="bg-muted"
                  >
                    <div
                      className={cn(
                        "overflow-hidden rounded-2xl border border-line bg-panel pl-4 pr-4 py-3 shadow-card flex flex-col gap-2 border-l-4",
                        e.fizruk
                          ? "border-l-sky-500"
                          : e.finykSub
                            ? "border-l-emerald-500"
                            : e.habitId
                              ? C.habitRowAccent
                              : "border-l-transparent",
                        e.completed && e.habitId && "opacity-90",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3 sm:gap-2">
                        <div
                          className={cn(
                            "min-w-0 flex-1",
                            e.habitId && "cursor-pointer",
                          )}
                          role={e.habitId ? "button" : undefined}
                          tabIndex={e.habitId ? 0 : undefined}
                          onClick={() =>
                            e.habitId && setDetailHabitId(e.habitId)
                          }
                          onKeyDown={(ev) => {
                            if (
                              e.habitId &&
                              (ev.key === "Enter" || ev.key === " ")
                            ) {
                              ev.preventDefault();
                              setDetailHabitId(e.habitId);
                            }
                          }}
                          aria-label={
                            e.habitId ? `Деталі: ${e.title}` : undefined
                          }
                        >
                          <p className="font-semibold text-text text-base leading-snug">
                            {e.title}
                          </p>
                          <p className="text-xs text-subtle mt-0.5">
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
                              className="!h-9 !px-3 !text-xs border border-line bg-panelHi/80"
                              type="button"
                              onClick={() =>
                                onOpenModule("fizruk", { hash: "plan" })
                              }
                            >
                              План
                            </Button>
                          )}
                          {e.finykSub && typeof onOpenModule === "function" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="!h-9 !px-3 !text-xs border border-emerald-500/25 bg-emerald-500/5"
                              type="button"
                              onClick={() =>
                                onOpenModule("finyk", { hash: "assets" })
                              }
                            >
                              Фінік
                            </Button>
                          )}
                          {e.habitId && (
                            <button
                              type="button"
                              onClick={() => onToggleHabit(e.habitId, e.date)}
                              className={cn(
                                "w-10 h-10 rounded-xl border flex items-center justify-center text-base font-bold transition-colors",
                                e.completed
                                  ? C.done
                                  : "border-line hover:bg-panelHi text-muted",
                              )}
                              aria-label={
                                e.completed ? "Скасувати виконання" : "Виконано"
                              }
                              title={e.completed ? "Скасувати" : "Виконано"}
                            >
                              {e.completed ? "✓" : "○"}
                            </button>
                          )}
                        </div>
                      </div>
                      {e.habitId && e.completed && (
                        <Input
                          className="routine-touch-field w-full min-w-0"
                          placeholder="Нотатка до відмітки"
                          value={
                            routine.completionNotes?.[
                              completionNoteKey(e.habitId, e.date)
                            ] || ""
                          }
                          onChange={(ev) =>
                            setRoutine((s) =>
                              setCompletionNote(
                                s,
                                e.habitId,
                                e.date,
                                ev.target.value,
                              ),
                            )
                          }
                        />
                      )}
                    </div>
                  </SwipeToAction>
                </div>
              );
            }}
          />
        )}
      </section>
      {detailHabitId && (
        <HabitDetailSheet
          habitId={detailHabitId}
          routine={routine}
          onClose={() => setDetailHabitId(null)}
        />
      )}
    </div>
  );
}
