import { cn } from "@shared/lib/cn";
import {
  addDays,
  dateKeyFromDate,
  parseDateKey,
  startOfIsoWeek,
} from "../lib/weekUtils.js";

function weekKeysFromAnchor(anchorKey) {
  const s = startOfIsoWeek(parseDateKey(anchorKey));
  return Array.from({ length: 7 }, (_, i) => dateKeyFromDate(addDays(s, i)));
}

export function WeekDayStrip({
  anchorKey,
  selectedDay,
  todayKey,
  onSelectDay,
  onShiftWeek,
}) {
  const keys = weekKeysFromAnchor(anchorKey);
  const short = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <button
        type="button"
        className="shrink-0 flex h-11 w-9 items-center justify-center rounded-xl border border-line/80 bg-panel/90 text-lg text-muted transition-colors hover:bg-panelHi hover:text-text"
        onClick={() => onShiftWeek(-1)}
        aria-label="Попередній тиждень"
      >
        ‹
      </button>
      <div className="grid min-w-0 flex-1 grid-cols-7 gap-0.5 sm:gap-1">
        {keys.map((k, i) => {
          const isSel = k === selectedDay;
          const isToday = k === todayKey;
          const dom = parseDateKey(k).getDate();
          return (
            <button
              key={k}
              type="button"
              onClick={() => onSelectDay(k)}
              className={cn(
                "flex min-h-[44px] flex-col items-center justify-center rounded-xl border py-1 text-[10px] font-semibold transition-colors sm:text-[11px]",
                isSel
                  ? "border-routine-ring bg-routine-surface2 text-text shadow-sm ring-1 ring-routine-line/50"
                  : "border-transparent bg-panelHi/50 text-muted hover:bg-panelHi hover:text-text",
                isToday && !isSel && "ring-1 ring-routine/40",
              )}
            >
              <span className="text-[9px] uppercase tracking-wide text-subtle">
                {short[i]}
              </span>
              <span className="tabular-nums text-sm text-text">{dom}</span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="shrink-0 flex h-11 w-9 items-center justify-center rounded-xl border border-line/80 bg-panel/90 text-lg text-muted transition-colors hover:bg-panelHi hover:text-text"
        onClick={() => onShiftWeek(1)}
        aria-label="Наступний тиждень"
      >
        ›
      </button>
    </div>
  );
}
