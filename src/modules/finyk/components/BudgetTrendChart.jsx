import { memo } from "react";
import { cn } from "@shared/lib/cn";

/**
 * Budget trend chart showing:
 * - Solid line: cumulative actual spending (past days)
 * - Dashed line: projected spending (future days)
 * - Horizontal limit line (if provided)
 */
// Чиста SVG-діаграма — безпечно мемоїзувати, графік перераховується лише
// коли змінюються масив dailyData, ліміт або колір.
function BudgetTrendChartComponent({
  dailyData,
  limit,
  color = "#6366f1",
  className,
}) {
  if (!dailyData || dailyData.length === 0) return null;

  const w = 320;
  const h = 80;
  const padL = 4;
  const padR = 4;
  const padT = 8;
  const padB = 16;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const n = dailyData.length;

  const allValues = dailyData
    .flatMap((d) => [d.actual, d.forecast])
    .filter((v) => v != null);
  if (limit) allValues.push(limit);
  const maxVal = Math.max(...allValues, 1);
  const minVal = 0;
  const range = maxVal - minVal || 1;

  const toX = (i) => padL + (i / (n - 1)) * innerW;
  const toY = (v) => padT + innerH - ((v - minVal) / range) * innerH;

  // Build actual path (solid)
  const actualPoints = dailyData
    .map((d, i) => (d.actual != null ? { x: toX(i), y: toY(d.actual) } : null))
    .filter(Boolean);

  const actualD = actualPoints
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  // Build forecast path (dashed) - starts from the bridge point (last actual day)
  const forecastPoints = dailyData
    .map((d, i) =>
      d.forecast != null ? { x: toX(i), y: toY(d.forecast) } : null,
    )
    .filter(Boolean);

  const forecastD = forecastPoints
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  // Area fill under actual line
  const areaD =
    actualPoints.length >= 2
      ? `${actualD} L ${actualPoints[actualPoints.length - 1].x.toFixed(1)} ${(padT + innerH).toFixed(1)} L ${actualPoints[0].x.toFixed(1)} ${(padT + innerH).toFixed(1)} Z`
      : "";

  const gradId = `btcFill${color.replace(/[^a-zA-Z0-9]/g, "")}`;

  // Limit line y
  const limitY = limit ? toY(limit) : null;

  // X-axis labels: first, middle, last day
  const labelIndices = new Set([0, Math.floor(n / 2), n - 1]);

  return (
    <div className={cn("w-full", className)}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-auto"
        role="img"
        aria-label="Графік тренду бюджету"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Limit line */}
        {limitY != null && (
          <line
            x1={padL}
            x2={w - padR}
            y1={limitY}
            y2={limitY}
            stroke="#ef4444"
            strokeWidth="1.2"
            strokeDasharray="4 3"
            opacity="0.7"
          />
        )}

        {/* Area fill under actual */}
        {areaD && <path d={areaD} fill={`url(#${gradId})`} />}

        {/* Actual line */}
        {actualD && (
          <path
            d={actualD}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Forecast dashed line */}
        {forecastD && (
          <path
            d={forecastD}
            fill="none"
            stroke={color}
            strokeWidth="1.8"
            strokeDasharray="5 3"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.65"
          />
        )}

        {/* Day labels */}
        {dailyData.map((d, i) => {
          if (!labelIndices.has(i)) return null;
          return (
            <text
              key={i}
              x={toX(i)}
              y={h - 2}
              textAnchor="middle"
              fontSize="8"
              className="fill-subtle"
            >
              {d.day}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export const BudgetTrendChart = memo(BudgetTrendChartComponent);
