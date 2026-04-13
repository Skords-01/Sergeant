import { cn } from "@shared/lib/cn";
import { ChartEmptyState } from "./ChartEmptyState";

const LABELS_UK = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

/** Легкий area-chart без залежностей; акцент — success з tailwind. */
export function WeeklyVolumeChart({ volumeKg, className }) {
  const vals =
    Array.isArray(volumeKg) && volumeKg.length === 7
      ? volumeKg
      : [0, 0, 0, 0, 0, 0, 0];
  const totalVol = vals.reduce((a, v) => a + (Number(v) || 0), 0);

  if (totalVol <= 0) {
    return (
      <div className={cn("w-full", className)}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-text">
            Тижневий обʼєм
          </span>
          <span
            className="text-2xs text-subtle flex items-center gap-1.5"
            aria-hidden
          >
            <span className="inline-block w-2 h-2 rounded-full bg-success" />
            кг×повт
          </span>
        </div>
        <ChartEmptyState
          title="Поки без обʼєму за тиждень"
          hint="Заверши тренування з силовими підходами — тут зʼявиться сумарний обʼєм (кг×повторення) по днях."
        />
      </div>
    );
  }

  const max = Math.max(1, ...vals.map((v) => Number(v) || 0));
  const w = 320;
  const h = 120;
  const padL = 36;
  const padR = 8;
  const padT = 12;
  const padB = 28;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const n = vals.length;
  const step = innerW / (n - 1 || 1);

  const points = vals.map((v, i) => {
    const x = padL + i * step;
    const y = padT + innerH - (Math.min(Number(v) || 0, max) / max) * innerH;
    return { x, y, v };
  });

  const lineD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const areaD = `${lineD} L ${points[n - 1].x.toFixed(1)} ${(padT + innerH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padT + innerH).toFixed(1)} Z`;

  const yTicks = [0, 0.5, 1].map((fr) => ({
    y: padT + innerH * (1 - fr),
    lab: fr === 0 ? "0" : fr === 1 ? formatYAxis(max) : formatYAxis(max * 0.5),
  }));

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-text">Тижневий обʼєм</span>
        <span
          className="text-2xs text-subtle flex items-center gap-1.5"
          aria-hidden
        >
          <span className="inline-block w-2 h-2 rounded-full bg-success" />
          кг×повт
        </span>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-auto max-h-[200px] overflow-visible"
        role="img"
        aria-label="Графік обсягу тренувань за дні поточного тижня"
      >
        <defs>
          <linearGradient id="wvFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(22 163 74)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="rgb(22 163 74)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {yTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={padL}
              x2={w - padR}
              y1={t.y}
              y2={t.y}
              stroke="currentColor"
              className="text-line/80"
              strokeWidth="1"
              strokeDasharray="3 4"
            />
            <text
              x={4}
              y={t.y + 4}
              className="fill-subtle text-[9px] font-medium"
            >
              {t.lab}
            </text>
          </g>
        ))}
        <path d={areaD} fill="url(#wvFill)" />
        <path
          d={lineD}
          fill="none"
          stroke="rgb(22 163 74)"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="3.5"
            className="fill-success stroke-white"
            strokeWidth="2"
          />
        ))}
        {LABELS_UK.map((lab, i) => {
          const x = padL + i * step;
          return (
            <text
              key={lab}
              x={x}
              y={h - 6}
              textAnchor="middle"
              className="fill-muted text-[9px] font-semibold"
            >
              {lab}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function formatYAxis(kg) {
  const n = Number(kg) || 0;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}
