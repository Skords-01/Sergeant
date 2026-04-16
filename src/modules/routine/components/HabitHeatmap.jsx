import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { cn } from "@shared/lib/cn";

const WEEKS = 53;
const DAYS = 7;
const DAY_LABELS = ["Пн", "", "Ср", "", "Пт", "", "Нд"];

function localDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function cellBg(ratio, isFuture) {
  if (isFuture) return "bg-line/15 dark:bg-line/10";
  if (ratio === 0) return "bg-panelHi dark:bg-line/25";
  if (ratio < 0.34) return "bg-orange-200/80 dark:bg-orange-900/55";
  if (ratio < 0.67) return "bg-orange-400/75 dark:bg-orange-600/70";
  return "bg-orange-500/90 dark:bg-orange-500/80";
}

export function HabitHeatmap({ habits, completions }) {
  const [selected, setSelected] = useState(null);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!selected) return;
    function onPointerDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setSelected(null);
      }
    }
    document.addEventListener("pointerdown", onPointerDown, { capture: true });
    return () => document.removeEventListener("pointerdown", onPointerDown, { capture: true });
  }, [selected]);

  const activeHabits = useMemo(
    () => (habits || []).filter((h) => !h.archived),
    [habits],
  );

  const { weeks, monthMarkers } = useMemo(() => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const todayKey = localDateKey(today);

    const dow = (today.getDay() + 6) % 7;
    const mondayThisWeek = new Date(today);
    mondayThisWeek.setDate(today.getDate() - dow);

    const startDate = new Date(mondayThisWeek);
    startDate.setDate(mondayThisWeek.getDate() - (WEEKS - 1) * 7);

    const cntByDay = {};
    for (const h of activeHabits) {
      for (const dk of completions?.[h.id] || []) {
        cntByDay[dk] = (cntByDay[dk] || 0) + 1;
      }
    }

    const weeks = [];
    const seenMonths = new Set();
    const monthMarkers = [];

    for (let w = 0; w < WEEKS; w++) {
      const week = [];
      for (let d = 0; d < DAYS; d++) {
        const dt = new Date(startDate);
        dt.setDate(startDate.getDate() + w * 7 + d);
        dt.setHours(12, 0, 0, 0);
        const key = localDateKey(dt);
        const isFuture = key > todayKey;
        const isToday = key === todayKey;
        const cnt = cntByDay[key] || 0;
        const total = activeHabits.length;
        const ratio = total > 0 && !isFuture ? cnt / total : 0;
        week.push({ key, dt, isFuture, isToday, cnt, total, ratio });

        const mk = `${dt.getFullYear()}-${dt.getMonth()}`;
        if (!seenMonths.has(mk)) {
          seenMonths.add(mk);
          monthMarkers.push({
            weekIdx: w,
            label: dt.toLocaleDateString("uk-UA", { month: "short" }),
          });
        }
      }
      weeks.push(week);
    }

    return { weeks, monthMarkers };
  }, [activeHabits, completions]);

  const handleClick = useCallback((key) => {
    setSelected((prev) => (prev === key ? null : key));
  }, []);

  const selectedCell = useMemo(() => {
    if (!selected) return null;
    for (const week of weeks) {
      for (const cell of week) {
        if (cell.key === selected) return cell;
      }
    }
    return null;
  }, [selected, weeks]);

  return (
    <div ref={rootRef} className="bg-panel border border-line/60 rounded-2xl p-4 shadow-card">
      <p className="text-xs font-bold text-subtle uppercase tracking-widest mb-3">
        Активність за рік
      </p>

      <div className="overflow-x-auto -mx-1 px-1 pb-1">
        <div style={{ display: "flex", gap: 0, alignItems: "flex-start" }}>
          <div
            style={{ display: "flex", flexDirection: "column", gap: 2, marginRight: 4, paddingTop: 16 }}
          >
            {DAY_LABELS.map((lbl, i) => (
              <div
                key={i}
                style={{ height: 12, fontSize: 8, lineHeight: "12px" }}
                className="text-subtle/70 text-right pr-1 select-none"
              >
                {lbl}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 2 }}>
            {weeks.map((week, w) => (
              <div key={w} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <div
                  style={{ height: 14, fontSize: 8, lineHeight: "14px", whiteSpace: "nowrap" }}
                  className="text-subtle/80 select-none"
                >
                  {monthMarkers.find((m) => m.weekIdx === w)?.label ?? ""}
                </div>
                {week.map((cell) => (
                  <button
                    key={cell.key}
                    type="button"
                    onClick={() => handleClick(cell.key)}
                    aria-label={`${cell.key}: ${cell.cnt} з ${cell.total} звичок`}
                    aria-pressed={cell.key === selected}
                    className={cn(
                      "rounded-sm transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400",
                      cellBg(cell.ratio, cell.isFuture),
                      cell.isToday && "ring-1 ring-orange-400/80 dark:ring-orange-300/70",
                      cell.key === selected && "opacity-60",
                    )}
                    style={{ width: 12, height: 12, flexShrink: 0 }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedCell ? (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-line/60 bg-bg px-3 py-2 text-xs">
          <span className="text-subtle truncate">
            {selectedCell.dt.toLocaleDateString("uk-UA", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
          <span className="font-semibold text-text shrink-0">
            {selectedCell.isFuture
              ? "ще не настало"
              : selectedCell.total === 0
                ? "немає звичок"
                : `${selectedCell.cnt} з ${selectedCell.total}`}
          </span>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2 text-[9px] text-subtle/70 select-none">
          <span>менше</span>
          {[
            "bg-panelHi dark:bg-line/25",
            "bg-orange-200/80 dark:bg-orange-900/55",
            "bg-orange-400/75 dark:bg-orange-600/70",
            "bg-orange-500/90 dark:bg-orange-500/80",
          ].map((c, i) => (
            <span
              key={i}
              className={cn("rounded-sm inline-block flex-shrink-0", c)}
              style={{ width: 10, height: 10 }}
            />
          ))}
          <span>більше</span>
        </div>
      )}
    </div>
  );
}
