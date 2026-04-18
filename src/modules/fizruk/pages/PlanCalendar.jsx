import { useMemo, useRef, useState } from "react";
import { Button } from "@shared/components/ui/Button";
import { EmptyState } from "@shared/components/ui/EmptyState";
import { cn } from "@shared/lib/cn";
import { useDialogFocusTrap } from "@shared/hooks/useDialogFocusTrap";
import { useExerciseCatalog } from "../hooks/useExerciseCatalog";
import { useMonthlyPlan } from "../hooks/useMonthlyPlan";
import { useRecovery } from "../hooks/useRecovery";
import { useWorkouts } from "../hooks/useWorkouts";
import { useWorkoutTemplates } from "../hooks/useWorkoutTemplates";
import { forecastFullRecoveryByDate } from "../lib/recoveryForecast.js";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

function monthGrid(year, monthIndex) {
  const last = new Date(year, monthIndex + 1, 0).getDate();
  const firstWd = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < firstWd; i++) cells.push(null);
  for (let d = 1; d <= last; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return { cells };
}

function dateKey(year, monthIndex, day) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function PlanCalendar() {
  const now = new Date();
  const [cursor, setCursor] = useState(() => ({
    y: now.getFullYear(),
    m: now.getMonth(),
  }));

  const { templates } = useWorkoutTemplates();
  const { musclesUk } = useExerciseCatalog();
  const { workouts } = useWorkouts();
  const rec = useRecovery();
  const { setDayTemplate, getTemplateForDate, days } = useMonthlyPlan();

  const [sheet, setSheet] = useState(null);
  const sheetRef = useRef(null);
  useDialogFocusTrap(!!sheet, sheetRef, { onEscape: () => setSheet(null) });

  const plannedByDate = useMemo(() => {
    const map = {};
    for (const w of workouts) {
      if (!w.planned || !w.startedAt) continue;
      const d = w.startedAt.slice(0, 10);
      if (!map[d]) map[d] = [];
      map[d].push(w);
    }
    return map;
  }, [workouts]);

  const forecast = useMemo(
    () => forecastFullRecoveryByDate(workouts, musclesUk),
    [workouts, musclesUk],
  );

  const recoveryRows = useMemo(() => {
    const rows = Object.entries(forecast)
      .map(([id, iso]) => ({
        id,
        label: musclesUk?.[id] || rec.by?.[id]?.label || id,
        iso,
        status: rec.by?.[id]?.status,
      }))
      .filter((r) => rec.by?.[r.id]?.lastAt != null);
    rows.sort((a, b) => {
      if (!a.iso && !b.iso) return a.label.localeCompare(b.label);
      if (!a.iso) return 1;
      if (!b.iso) return -1;
      return a.iso.localeCompare(b.iso);
    });
    return rows;
  }, [forecast, musclesUk, rec.by]);

  const { cells } = monthGrid(cursor.y, cursor.m);
  const monthTitle = new Date(cursor.y, cursor.m, 1).toLocaleDateString(
    "uk-UA",
    { month: "long", year: "numeric" },
  );

  const go = (delta) => {
    setCursor((c) => {
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

  const openDay = (day) => {
    if (!day) return;
    const key = dateKey(cursor.y, cursor.m, day);
    setSheet({
      key,
      day,
      templateId: getTemplateForDate(key),
      planned: plannedByDate[key] || [],
    });
  };

  const applySheet = (templateId) => {
    if (!sheet) return;
    setDayTemplate(sheet.key, templateId);
    setSheet(null);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 pt-4 page-tabbar-pad space-y-4">
        <section className="bg-panel border border-line/60 rounded-2xl p-4 shadow-card">
          <div className="flex items-center justify-between gap-2 mb-4">
            <button
              type="button"
              className="w-10 h-10 rounded-xl border border-line text-lg"
              onClick={() => go(-1)}
              aria-label="Попередній місяць"
            >
              ‹
            </button>
            <h2 className="text-base font-bold text-text capitalize">
              {monthTitle}
            </h2>
            <button
              type="button"
              className="w-10 h-10 rounded-xl border border-line text-lg"
              onClick={() => go(1)}
              aria-label="Наступний місяць"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-subtle mb-2">
            {WEEKDAYS.map((w) => (
              <div key={w}>{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (day == null) {
                return (
                  <div
                    key={`e-${i}`}
                    className="min-h-[52px] rounded-xl bg-bg/40"
                  />
                );
              }
              const key = dateKey(cursor.y, cursor.m, day);
              const tid = days[key]?.templateId;
              const tpl = tid ? templates.find((t) => t.id === tid) : null;
              const planned = plannedByDate[key] || [];
              const isToday =
                key ===
                `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => openDay(day)}
                  className={cn(
                    "min-h-[52px] rounded-xl border p-1 flex flex-col items-center justify-start transition-colors",
                    isToday
                      ? "border-success bg-success/10"
                      : planned.length > 0
                        ? "border-success/50 bg-success/8 hover:bg-success/15"
                        : "border-line bg-panelHi/50 hover:bg-panelHi",
                  )}
                >
                  <span className="text-xs font-bold text-text">{day}</span>
                  {tpl && (
                    <span className="text-[9px] text-subtle leading-tight line-clamp-1 mt-0.5 px-0.5">
                      {tpl.name}
                    </span>
                  )}
                  {planned.length > 0 && (
                    <span className="text-[8px] text-success font-bold leading-tight mt-0.5">
                      🏋️{" "}
                      {planned.length > 1
                        ? `×${planned.length}`
                        : planned[0].note ||
                          `${planned[0].items?.length ?? 0}впр`}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-subtle mt-3">
            Натисни день, щоб призначити або зняти шаблон.
          </p>
        </section>

        <section className="bg-panel border border-line/60 rounded-2xl p-4 shadow-card">
          <h2 className="text-sm font-semibold text-text mb-1">
            Повне відновлення м’язів (прогноз)
          </h2>
          <p className="text-[11px] text-subtle mb-3 leading-snug">
            Орієнтовна дата, коли навантаження спаде до «зеленого» стану (модель
            як у блоці відновлення).
          </p>
          {recoveryRows.length === 0 ? (
            <EmptyState
              compact
              title="Поки що порожньо"
              description="Потрібні завершені тренування з вправами — дані зʼявляться автоматично."
            />
          ) : (
            <ul className="space-y-2 max-h-64 overflow-y-auto">
              {recoveryRows.map((r) => (
                <li
                  key={r.id}
                  className="flex justify-between gap-2 text-sm border-b border-line/40 pb-2 last:border-0"
                >
                  <span className="text-text min-w-0 truncate">{r.label}</span>
                  <span className="text-subtle tabular-nums shrink-0 text-right">
                    {r.iso
                      ? new Date(r.iso + "T12:00:00").toLocaleDateString(
                          "uk-UA",
                          { day: "numeric", month: "short" },
                        )
                      : "> 21 дн."}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {sheet && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Закрити"
            onClick={() => setSheet(null)}
          />
          <div
            ref={sheetRef}
            className="relative w-full max-w-md bg-panel border-t border-line rounded-t-3xl p-5 shadow-soft pb-8"
            role="dialog"
            aria-modal="true"
          >
            <div className="text-sm font-bold text-text mb-3">
              {new Date(sheet.key + "T12:00:00").toLocaleDateString("uk-UA", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </div>
            {sheet.planned?.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-bold text-success mb-2">
                  🏋️ Заплановані тренування
                </p>
                <div className="space-y-2">
                  {sheet.planned.map((w) => {
                    const t = w.startedAt
                      ? new Date(w.startedAt).toLocaleTimeString("uk-UA", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : null;
                    return (
                      <div
                        key={w.id}
                        className="rounded-xl border border-success/30 bg-success/8 px-3 py-2 text-sm"
                      >
                        <div className="font-semibold text-text">
                          {t && (
                            <span className="text-success mr-1.5">{t}</span>
                          )}
                          {w.note || "Тренування"}
                        </div>
                        {w.items?.length > 0 && (
                          <div className="text-[11px] text-subtle mt-0.5">
                            {w.items
                              .map((it) => it.nameUk || it.name)
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="border-t border-line/40 my-3" />
              </div>
            )}

            <p className="text-xs text-subtle mb-3">Шаблон тренування</p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              <button
                type="button"
                className={cn(
                  "w-full text-left px-3 py-3 rounded-xl border text-sm",
                  !sheet.templateId
                    ? "border-success bg-success/10"
                    : "border-line hover:bg-panelHi",
                )}
                onClick={() => applySheet(null)}
              >
                Без плану (вихідний)
              </button>
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={cn(
                    "w-full text-left px-3 py-3 rounded-xl border text-sm",
                    sheet.templateId === t.id
                      ? "border-success bg-success/10"
                      : "border-line hover:bg-panelHi",
                  )}
                  onClick={() => applySheet(t.id)}
                >
                  {t.name}
                </button>
              ))}
            </div>
            {templates.length === 0 && (
              <p className="text-xs text-subtle mt-2">
                Спочатку створи шаблон у «Тренування → Шаблони».
              </p>
            )}
            <Button
              type="button"
              variant="ghost"
              className="w-full mt-4"
              onClick={() => setSheet(null)}
            >
              Закрити
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
