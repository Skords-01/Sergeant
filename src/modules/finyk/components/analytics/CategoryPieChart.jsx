import { memo } from "react";
import { cn } from "@shared/lib/cn";

function polarToXY(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx, cy, r, startDeg, endDeg) {
  const start = polarToXY(cx, cy, r, startDeg);
  const end = polarToXY(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

// Презентаційна кругова діаграма для статистики категорій.
// Результат повністю залежить від вхідних пропсів, тому `memo` вимикає зайві
// перерендери при змінах стану сторінки Analytics.
function CategoryPieChartComponent({ data = [], size = 160, className }) {
  if (!data || data.length === 0) return null;

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 10;
  const innerR = r * 0.55;

  const total = data.reduce((s, d) => s + d.spent, 0);
  if (total === 0) return null;

  const TOP_N = 5;
  const top = data.slice(0, TOP_N);
  const otherSpent = data.slice(TOP_N).reduce((s, d) => s + d.spent, 0);
  const segments =
    otherSpent > 0
      ? [
          ...top,
          {
            categoryId: "_other",
            label: "Інше",
            spent: otherSpent,
            color: "#94a3b8",
          },
        ]
      : top;

  let currentAngle = 0;
  const arcs = segments.map((seg) => {
    const pct = seg.spent / total;
    const sweep = pct * 360;
    const start = currentAngle;
    currentAngle += sweep;
    return { ...seg, start, end: currentAngle, pct };
  });

  return (
    <div className={cn("w-full", className)}>
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="shrink-0"
          role="img"
          aria-label="Кругова діаграма категорій"
        >
          {arcs.map((arc, i) => {
            const sweep = arc.end - arc.start;
            if (sweep < 0.5) return null;
            const d = describeArc(cx, cy, r, arc.start, arc.end - 0.3);
            return (
              <path
                key={arc.categoryId || i}
                d={d}
                fill="none"
                stroke={arc.color}
                strokeWidth={r - innerR}
                strokeLinecap="butt"
              />
            );
          })}
          <text
            x={cx}
            y={cy - 4}
            textAnchor="middle"
            fontSize="11"
            className="fill-muted font-medium"
          >
            Всього
          </text>
          <text
            x={cx}
            y={cy + 12}
            textAnchor="middle"
            fontSize="13"
            fontWeight="600"
            className="fill-text"
          >
            {total.toLocaleString("uk-UA")} ₴
          </text>
        </svg>

        <div className="flex-1 w-full space-y-1.5 min-w-0">
          {arcs.map((arc) => (
            <div
              key={arc.categoryId}
              className="flex items-center gap-2 text-sm"
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: arc.color }}
              />
              <span className="text-text truncate flex-1 min-w-0 text-xs">
                {arc.label}
              </span>
              {(() => {
                // `arc.pct` is the fraction of `total` (0..1), not a
                // percentage. The old guard `arc.pct < 1` was effectively
                // always true and showed "<1%" on every slice. Round to the
                // integer percentage first, then keep the "<1" hint for
                // segments that round to zero but are still > 0.
                const pctInt = Math.round(arc.pct * 100);
                return (
                  <span className="text-muted tabular-nums text-xs shrink-0">
                    {pctInt < 1 ? "<1" : pctInt}%
                  </span>
                );
              })()}
              <span className="text-text tabular-nums text-xs font-medium shrink-0">
                {arc.spent.toLocaleString("uk-UA")} ₴
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const CategoryPieChart = memo(CategoryPieChartComponent);
