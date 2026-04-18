import { cn } from "@shared/lib/cn";

export function MonthlyChart({ data = [], height = 120, className }) {
  if (!data || data.length === 0) return null;

  const w = 320;
  const h = height;
  const padL = 8;
  const padR = 8;
  const padT = 8;
  const padB = 24;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  const maxVal = Math.max(...data.flatMap((d) => [d.spent, d.income]), 1);
  const n = data.length;
  const barW = Math.max(4, Math.floor(innerW / n) - 4);
  const gap = (innerW - barW * n) / Math.max(n - 1, 1);

  const toX = (i) => padL + i * (barW + gap);
  const toH = (v) => Math.max(2, (v / maxVal) * innerH);
  const toY = (v) => padT + innerH - toH(v);

  const spentColor = "#ef4444";
  const incomeColor = "#10b981";

  const gradSpentId = "mcSpent";
  const gradIncomeId = "mcIncome";

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center gap-4 mb-2 text-[10px] text-subtle">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: spentColor }} />
          Витрати
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: incomeColor }} />
          Дохід
        </span>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-auto"
        role="img"
        aria-label="Графік витрат і доходів по місяцях"
      >
        <defs>
          <linearGradient id={gradSpentId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={spentColor} stopOpacity="0.9" />
            <stop offset="100%" stopColor={spentColor} stopOpacity="0.5" />
          </linearGradient>
          <linearGradient id={gradIncomeId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={incomeColor} stopOpacity="0.9" />
            <stop offset="100%" stopColor={incomeColor} stopOpacity="0.5" />
          </linearGradient>
        </defs>

        {data.map((d, i) => {
          const x = toX(i);
          const half = Math.max(1, Math.floor(barW / 2) - 1);

          return (
            <g key={d.month || i}>
              {d.income > 0 && (
                <rect
                  x={x}
                  y={toY(d.income)}
                  width={half}
                  height={toH(d.income)}
                  rx="2"
                  fill={`url(#${gradIncomeId})`}
                />
              )}
              {d.spent > 0 && (
                <rect
                  x={x + half + 1}
                  y={toY(d.spent)}
                  width={half}
                  height={toH(d.spent)}
                  rx="2"
                  fill={`url(#${gradSpentId})`}
                />
              )}
              <text
                x={x + barW / 2}
                y={h - 4}
                textAnchor="middle"
                fontSize="7"
                className="fill-subtle"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
