import { useState, useMemo } from "react";
import { SectionHeading } from "@shared/components/ui/SectionHeading";
import { cn } from "@shared/lib/cn";
import { useLocalStorageState } from "@shared/hooks/useLocalStorageState.js";
import { generateInsights } from "./lib/insightsEngine";
import {
  calcFinykSpendingByDate,
  getFinykExcludedTxIdsFromStorage,
  getFinykTxSplitsFromStorage,
} from "@finyk/utils";

function safeParseLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) ?? fallback;
  } catch {
    return fallback;
  }
}

function parseFizrukWorkouts(raw) {
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p)) return p;
    if (p && Array.isArray(p.workouts)) return p.workouts;
  } catch {}
  return [];
}

function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function getPeriodRange(period, offset = 0) {
  const now = new Date();
  if (period === "week") {
    const mondayOffset = (now.getDay() + 6) % 7;
    const mon = new Date(now);
    mon.setDate(now.getDate() - mondayOffset + offset * 7);
    mon.setHours(0, 0, 0, 0);
    const sun = addDays(mon, 6);
    return { start: mon, end: sun };
  } else {
    const y = now.getFullYear();
    const m = now.getMonth() + offset;
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0);
    return { start, end };
  }
}

function datesInRange(start, end) {
  const dates = [];
  const d = new Date(start);
  while (d <= end) {
    dates.push(localDateKey(d));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function useReportData(period, offset) {
  return useMemo(() => {
    const cur = getPeriodRange(period, offset);
    const prev = getPeriodRange(period, offset - 1);

    const curDates = datesInRange(cur.start, cur.end);
    const prevDates = datesInRange(prev.start, prev.end);

    function collectWorkouts(dates) {
      const workouts = parseFizrukWorkouts(
        localStorage.getItem("fizruk_workouts_v1"),
      );
      if (!workouts.length && !localStorage.getItem("fizruk_workouts_v1"))
        return { count: 0, daily: {} };
      const dateSet = new Set(dates);
      const daily = {};
      let count = 0;
      for (const w of workouts) {
        if (!w.endedAt) continue;
        const dk = localDateKey(new Date(w.startedAt));
        if (!dateSet.has(dk)) continue;
        count++;
        daily[dk] = (daily[dk] || 0) + 1;
      }
      return { count, daily };
    }

    function collectSpending(dates) {
      const txRaw = safeParseLS("finyk_tx_cache", null);
      const txList = txRaw?.txs ?? txRaw ?? [];
      const excludedTxIds = getFinykExcludedTxIdsFromStorage();
      const txSplits = getFinykTxSplitsFromStorage();
      return calcFinykSpendingByDate(txList, {
        excludedTxIds,
        txSplits: txSplits as Record<string, unknown[]>,
        dateSet: new Set(dates),
        localDateKeyFn: localDateKey,
      });
    }

    function collectHabits(dates) {
      const state = safeParseLS("hub_routine_v1", null);
      if (!state) return { pct: 0, daily: {} };
      const habits = Array.isArray(state.habits)
        ? state.habits.filter((h) => !h.archived)
        : [];
      const completions = state.completions ?? {};
      if (!habits.length) return { pct: 0, daily: {} };

      const daily = {};
      let totalPossible = 0,
        totalDone = 0;
      for (const dk of dates) {
        const possible = habits.length;
        const done = habits.filter(
          (h) =>
            Array.isArray(completions[h.id]) && completions[h.id].includes(dk),
        ).length;
        totalPossible += possible;
        totalDone += done;
        daily[dk] = possible > 0 ? Math.round((done / possible) * 100) : 0;
      }
      return {
        pct:
          totalPossible > 0 ? Math.round((totalDone / totalPossible) * 100) : 0,
        daily,
      };
    }

    function collectKcal(dates) {
      const log = safeParseLS("nutrition_log_v1", {});
      const dateSet = new Set(dates);
      const daily = {};
      let total = 0;
      for (const dk of Object.keys(log)) {
        if (!dateSet.has(dk)) continue;
        const meals = Array.isArray(log[dk]?.meals) ? log[dk].meals : [];
        const kcal = meals.reduce((s, m) => s + (m?.macros?.kcal ?? 0), 0);
        total += kcal;
        daily[dk] = Math.round(kcal);
      }
      const daysWithData = Object.keys(daily).length;
      return {
        total: Math.round(total),
        avg: daysWithData > 0 ? Math.round(total / daysWithData) : 0,
        daily,
      };
    }

    return {
      period: { start: cur.start, end: cur.end, dates: curDates },
      workouts: {
        cur: collectWorkouts(curDates),
        prev: collectWorkouts(prevDates),
      },
      spending: {
        cur: collectSpending(curDates),
        prev: collectSpending(prevDates),
      },
      habits: { cur: collectHabits(curDates), prev: collectHabits(prevDates) },
      kcal: { cur: collectKcal(curDates), prev: collectKcal(prevDates) },
    };
  }, [period, offset]);
}

function formatPeriodLabel(period, offset) {
  const { start, end } = getPeriodRange(period, offset);
  if (period === "week") {
    const opts: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric",
    };
    return `${start.toLocaleDateString("uk-UA", opts)} – ${end.toLocaleDateString("uk-UA", opts)}`;
  } else {
    return start.toLocaleDateString("uk-UA", {
      month: "long",
      year: "numeric",
    });
  }
}

function BarChart({
  data,
  dates,
  colorClass,
  maxValue,
  unit = "",
}: {
  data: Record<string, number>;
  dates: string[];
  colorClass: string;
  maxValue?: number;
  unit?: string;
}) {
  const vals = dates.map((d) => data[d] ?? 0);
  const max = maxValue || Math.max(...vals, 1);
  const hasData = vals.some((v) => v > 0);

  if (!hasData) {
    return (
      <div className="h-20 flex items-center justify-center text-xs text-muted">
        Немає даних
      </div>
    );
  }

  return (
    <div className="flex items-end gap-0.5 h-20" aria-label="Графік">
      {vals.map((v, i) => {
        const pct = Math.max(0, Math.min(100, (v / max) * 100));
        const isToday = dates[i] === localDateKey();
        return (
          <div
            key={dates[i]}
            className="flex-1 flex flex-col items-center justify-end gap-0.5 h-full"
            title={`${dates[i]}: ${v}${unit}`}
          >
            <div
              className={cn(
                "w-full rounded-t-sm transition-all",
                colorClass,
                isToday && "opacity-100",
                !isToday && "opacity-60",
              )}
              style={{ height: `${pct}%`, minHeight: v > 0 ? "2px" : "0" }}
            />
          </div>
        );
      })}
    </div>
  );
}

function Delta({ cur, prev, higherIsBetter = true }) {
  if (prev === 0 && cur === 0) return null;
  if (prev === 0) return <span className="text-xs text-muted">—</span>;
  const diff = cur - prev;
  const pct = Math.round((diff / prev) * 100);
  const positive = higherIsBetter ? diff >= 0 : diff <= 0;
  const sign = diff >= 0 ? "+" : "";
  return (
    <span
      className={cn(
        "text-xs font-medium",
        positive ? "text-success" : "text-danger",
      )}
    >
      {sign}
      {pct}%
    </span>
  );
}

function StatCard({
  title,
  icon,
  current,
  prev,
  unit,
  higherIsBetter,
  chart,
  storageKey,
}) {
  const [collapsed, setCollapsed] = useLocalStorageState<boolean>(
    storageKey,
    false,
    { validate: (v): v is boolean => typeof v === "boolean" },
  );
  const formattedCurrent =
    typeof current === "number" ? current.toLocaleString("uk-UA") : current;
  const formattedPrev =
    typeof prev === "number" ? prev.toLocaleString("uk-UA") : prev;

  return (
    <div
      className={cn(
        "bg-panel border border-line rounded-2xl",
        collapsed ? "p-3" : "p-4 space-y-3",
      )}
    >
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        className={cn(
          "w-full flex items-center gap-2 text-left rounded-lg",
          "-m-1 p-1 hover:bg-panelHi transition-colors",
        )}
      >
        <span className="text-lg shrink-0" aria-hidden>
          {icon}
        </span>
        <SectionHeading
          as="span"
          size="xs"
          className="flex-1 min-w-0 text-muted truncate"
        >
          {title}
        </SectionHeading>
        {collapsed && (
          <span className="flex items-baseline gap-2 shrink-0">
            <span className="text-base font-bold text-text">
              {formattedCurrent}
              {unit}
            </span>
            <Delta cur={current} prev={prev} higherIsBetter={higherIsBetter} />
          </span>
        )}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className={cn(
            "shrink-0 text-muted transition-transform",
            collapsed ? "-rotate-90" : "rotate-0",
          )}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {!collapsed && (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-text">
              {formattedCurrent}
              {unit}
            </span>
            <Delta cur={current} prev={prev} higherIsBetter={higherIsBetter} />
          </div>
          {prev !== undefined && (
            <p className="text-xs text-muted">
              Минулий: {formattedPrev}
              {unit}
            </p>
          )}
          {chart}
        </>
      )}
    </div>
  );
}

function InsightCard({ emoji, title, stat, detail }) {
  return (
    <div className="bg-panel border border-line rounded-2xl p-4 flex gap-3 items-start">
      <span className="text-2xl shrink-0 leading-none pt-0.5">{emoji}</span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm text-text leading-snug">{title}</p>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-lg font-bold text-brand-600 dark:text-brand-400">
            {stat}
          </span>
          {detail && (
            <span className="text-xs text-muted truncate">{detail}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function HubReports() {
  const [period, setPeriod] = useState("week");
  const [offset, setOffset] = useState(0);

  const data = useReportData(period, offset);
  const label = formatPeriodLabel(period, offset);
  const isCurrentPeriod = offset === 0;

  const dates = data.period.dates;
  const insights = useMemo(() => generateInsights(), []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex rounded-xl overflow-hidden border border-line shrink-0">
          {["week", "month"].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setPeriod(p);
                setOffset(0);
              }}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors",
                period === p
                  ? "bg-brand-500 text-white"
                  : "text-muted hover:text-text hover:bg-panelHi",
              )}
            >
              {p === "week" ? "Тиждень" : "Місяць"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setOffset((o) => o - 1)}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-muted hover:text-text hover:bg-panelHi transition-colors"
            aria-label="Попередній"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <span className="text-xs text-muted min-w-[90px] text-center">
            {label}
          </span>
          <button
            type="button"
            onClick={() => setOffset((o) => Math.min(0, o + 1))}
            disabled={isCurrentPeriod}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-muted hover:text-text hover:bg-panelHi transition-colors disabled:opacity-30"
            aria-label="Наступний"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <StatCard
          title="Тренування (Фізрук)"
          icon="🏋️"
          storageKey="hub_reports_collapsed_v1:workouts"
          current={data.workouts.cur.count}
          prev={data.workouts.prev.count}
          unit=" трен."
          higherIsBetter={true}
          chart={
            <BarChart
              data={data.workouts.cur.daily}
              dates={dates}
              colorClass="bg-sky-500"
              unit=" трен."
            />
          }
        />

        <StatCard
          title="Витрати (Фінік)"
          icon="💳"
          storageKey="hub_reports_collapsed_v1:spending"
          current={data.spending.cur.total}
          prev={data.spending.prev.total}
          unit=" ₴"
          higherIsBetter={false}
          chart={
            <BarChart
              data={data.spending.cur.daily}
              dates={dates}
              colorClass="bg-emerald-500"
              unit=" ₴"
            />
          }
        />

        <StatCard
          title="Виконання звичок (Рутина)"
          icon="✅"
          storageKey="hub_reports_collapsed_v1:habits"
          current={data.habits.cur.pct}
          prev={data.habits.prev.pct}
          unit="%"
          higherIsBetter={true}
          chart={
            <BarChart
              data={data.habits.cur.daily}
              dates={dates}
              colorClass="bg-orange-500"
              maxValue={100}
              unit="%"
            />
          }
        />

        <StatCard
          title="Середньо ккал/день (Харчування)"
          icon="🥗"
          storageKey="hub_reports_collapsed_v1:kcal"
          current={data.kcal.cur.avg}
          prev={data.kcal.prev.avg}
          unit=" ккал"
          higherIsBetter={true}
          chart={
            <BarChart
              data={data.kcal.cur.daily}
              dates={dates}
              colorClass="bg-lime-500"
              unit=" ккал"
            />
          }
        />
      </div>

      {insights.length >= 2 ? (
        <div className="space-y-3">
          <SectionHeading as="p" size="sm">
            Інсайти
          </SectionHeading>
          {insights.map((ins) => (
            <InsightCard key={ins.id} {...ins} />
          ))}
        </div>
      ) : (
        <div className="bg-panel border border-line rounded-2xl p-4 text-center text-xs text-muted">
          Збери більше даних для інсайтів
        </div>
      )}

      <div className="bg-panel border border-line rounded-2xl p-4">
        <SectionHeading as="p" size="xs" className="mb-3">
          Підсумок
        </SectionHeading>
        <div className="space-y-2 text-sm text-text">
          {data.workouts.cur.count > 0 && (
            <p>
              🏋️ Ви тренувались <strong>{data.workouts.cur.count}</strong>{" "}
              {data.workouts.cur.count === 1
                ? "раз"
                : data.workouts.cur.count < 5
                  ? "рази"
                  : "разів"}
            </p>
          )}
          {data.spending.cur.total > 0 && (
            <p>
              💳 Витрачено{" "}
              <strong>
                {data.spending.cur.total.toLocaleString("uk-UA")} ₴
              </strong>
            </p>
          )}
          {data.habits.cur.pct > 0 && (
            <p>
              ✅ Звички виконано на <strong>{data.habits.cur.pct}%</strong>
            </p>
          )}
          {data.kcal.cur.avg > 0 && (
            <p>
              🥗 Середньо{" "}
              <strong>
                {data.kcal.cur.avg.toLocaleString("uk-UA")} ккал/день
              </strong>
            </p>
          )}
          {data.workouts.cur.count === 0 &&
            data.spending.cur.total === 0 &&
            data.habits.cur.pct === 0 &&
            data.kcal.cur.avg === 0 && (
              <p className="text-muted text-center py-2">
                Немає даних за цей період
              </p>
            )}
        </div>
      </div>
    </div>
  );
}
