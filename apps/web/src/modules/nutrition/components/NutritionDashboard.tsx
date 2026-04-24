import { useMemo } from "react";
import { Card } from "@shared/components/ui/Card";
import { SectionHeading } from "@shared/components/ui/SectionHeading";
import { cn } from "@shared/lib/cn";
import {
  getDayMacros,
  getDaySummary,
  getMacrosForDateRange,
  toLocalISODate,
} from "../lib/nutritionStorage.js";
import { WaterTrackerCard } from "./WaterTrackerCard.jsx";

function todayISO() {
  return toLocalISODate(new Date());
}

function pct(cur, target) {
  if (!(target > 0)) return 0;
  return Math.min(100, (cur / target) * 100);
}

function ring(percent, color, size = 56, stroke = 5) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(percent, 100) / 100) * circ;
  return (
    <svg width={size} height={size} className="block -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        className="text-line/30"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        className="transition-[stroke-dasharray,stroke-dashoffset] duration-500"
      />
    </svg>
  );
}

const MACRO_DEFS = [
  {
    key: "kcal",
    label: "Ккал",
    color: "#f97316",
    prefKey: "dailyTargetKcal",
    unit: "",
  },
  {
    key: "protein_g",
    label: "Білки",
    color: "#3b82f6",
    prefKey: "dailyTargetProtein_g",
    unit: "г",
  },
  {
    key: "fat_g",
    label: "Жири",
    color: "#eab308",
    prefKey: "dailyTargetFat_g",
    unit: "г",
  },
  {
    key: "carbs_g",
    label: "Вуглев.",
    color: "#22c55e",
    prefKey: "dailyTargetCarbs_g",
    unit: "г",
  },
];

function MiniBar({ rows, targetKcal }) {
  const max = Math.max(targetKcal || 1, ...rows.map((r) => r.kcal || 0));
  const dayLabels = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];
  return (
    <div className="flex items-end gap-1 h-16">
      {rows.map((r) => {
        const h = max > 0 ? Math.max(2, (r.kcal / max) * 100) : 2;
        const isToday = r.date === todayISO();
        const dayOfWeek = new Date(r.date + "T00:00:00").getDay();
        const label = dayLabels[(dayOfWeek + 6) % 7];
        return (
          <div
            key={r.date}
            className="flex-1 flex flex-col items-center gap-0.5"
          >
            <div
              className="w-full flex justify-center"
              style={{ height: "48px", alignItems: "flex-end" }}
            >
              <div
                className={cn(
                  "w-full max-w-[18px] rounded-t-md transition-[height,background-color] duration-300",
                  isToday ? "bg-nutrition" : "bg-nutrition/30",
                )}
                style={{ height: `${h}%`, minHeight: "3px" }}
              />
            </div>
            <span
              className={cn(
                "text-3xs leading-none",
                isToday ? "text-text font-bold" : "text-muted",
              )}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function NutritionDashboard({
  log,
  prefs,
  onGoToLog,
  onAddMeal,
  onFetchDayHint,
  dayHintText,
  dayHintBusy,
}) {
  const today = todayISO();

  const macros = useMemo(() => getDayMacros(log, today), [log, today]);
  const summary = useMemo(() => getDaySummary(log, today), [log, today]);
  const weekRows = useMemo(
    () => getMacrosForDateRange(log, today, 7),
    [log, today],
  );

  const hasTargets =
    (prefs.dailyTargetKcal || 0) > 0 ||
    (prefs.dailyTargetProtein_g || 0) > 0 ||
    (prefs.dailyTargetFat_g || 0) > 0 ||
    (prefs.dailyTargetCarbs_g || 0) > 0;

  return (
    <div className="grid gap-3">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-semibold text-text">Сьогодні</div>
            <div className="text-xs text-subtle">
              {summary.mealCount}{" "}
              {summary.mealCount === 1
                ? "прийом"
                : summary.mealCount >= 2 && summary.mealCount <= 4
                  ? "прийоми"
                  : "прийомів"}{" "}
              їжі
            </div>
          </div>
          <button
            type="button"
            onClick={onAddMeal}
            className={cn(
              "shrink-0 px-4 h-9 rounded-xl text-sm font-semibold",
              "bg-nutrition-strong text-white hover:bg-nutrition-hover transition-colors",
            )}
          >
            + Додати
          </button>
        </div>

        {hasTargets ? (
          <div className="grid grid-cols-4 gap-2">
            {MACRO_DEFS.map((m) => {
              const cur = Math.round(macros[m.key] || 0);
              const target = prefs[m.prefKey] || 0;
              const p = pct(cur, target);
              return (
                <div key={m.key} className="flex flex-col items-center gap-1">
                  <div className="relative">
                    {ring(p, m.color)}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-bold text-text leading-none">
                        {cur}
                      </span>
                    </div>
                  </div>
                  <div className="text-2xs text-subtle font-semibold leading-none">
                    {m.label}
                  </div>
                  {target > 0 && (
                    <div className="text-3xs text-muted leading-none">
                      / {target}
                      {m.unit}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {MACRO_DEFS.map((m) => {
              const cur = Math.round(macros[m.key] || 0);
              return (
                <div
                  key={m.key}
                  className="rounded-xl border border-nutrition/20 bg-nutrition/8 px-2 py-2.5 text-center"
                >
                  <SectionHeading
                    as="div"
                    size="xs"
                    tone="nutrition"
                    className="leading-none mb-1"
                  >
                    {m.label}
                  </SectionHeading>
                  <div className="text-sm font-extrabold text-text leading-none">
                    {cur}
                    {m.unit ? ` ${m.unit}` : ""}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!hasTargets && (
          <button
            type="button"
            onClick={onGoToLog}
            className="mt-3 w-full text-xs text-nutrition-strong dark:text-nutrition font-medium hover:underline text-center"
          >
            Налаштувати денні цілі КБЖВ →
          </button>
        )}
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-text">Тиждень · ккал</div>
          <button
            type="button"
            onClick={onGoToLog}
            className="text-xs text-nutrition-strong dark:text-nutrition font-medium hover:underline"
          >
            Журнал →
          </button>
        </div>
        <MiniBar rows={weekRows} targetKcal={prefs.dailyTargetKcal || 0} />
      </Card>

      <WaterTrackerCard goalMl={prefs.waterGoalMl ?? 2000} />

      {typeof onFetchDayHint === "function" && (
        <Card className="p-4">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="text-sm font-semibold text-text">Підказка AI</div>
            <button
              type="button"
              onClick={onFetchDayHint}
              disabled={dayHintBusy}
              className="shrink-0 px-3 h-8 rounded-xl text-xs font-semibold bg-nutrition/10 text-nutrition-strong dark:text-nutrition border border-nutrition/30 hover:bg-nutrition/20 transition-colors disabled:opacity-50"
            >
              {dayHintBusy ? "…" : "Отримати"}
            </button>
          </div>
          {dayHintText ? (
            <p className="text-sm text-text leading-snug">{dayHintText}</p>
          ) : (
            <p className="text-xs text-subtle">
              Аналіз харчування за сьогодні від AI
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
