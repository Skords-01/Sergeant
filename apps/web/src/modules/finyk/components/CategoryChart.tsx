import { memo } from "react";
import { chartPaletteList as COLORS } from "../constants/chartPalette";

// Чиста презентаційна діаграма: рендер залежить лише від `data` та `onBarClick`.
// `memo` уникає перерендеру, коли батько оновлюється, а ці пропси не змінилися
// (напр. зміна фільтрів транзакцій не повинна торкатись графіка категорій).
function CategoryChartComponent({ data, onBarClick }) {
  const maxVal = data[0]?.spent || 1;
  return (
    <div className="flex flex-col gap-3">
      {data.map((cat, i) => {
        const row = (
          <>
            <div className="flex justify-between mb-1.5">
              <span className="text-xs text-muted group-hover:text-text transition-colors">
                {cat.label.split(" ")[0]} {cat.label.slice(3)}
              </span>
              <span className="text-xs font-bold">
                −{cat.spent.toLocaleString("uk-UA")} ₴
              </span>
            </div>
            <div className="h-1.5 bg-line rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-[width,background-color] duration-500"
                style={{
                  width: `${(cat.spent / maxVal) * 100}%`,
                  background: COLORS[i % COLORS.length],
                }}
              />
            </div>
          </>
        );
        return onBarClick ? (
          <button
            key={i}
            type="button"
            onClick={() => onBarClick(cat.id)}
            className="cursor-pointer group w-full text-left border-0 bg-transparent p-0 font-inherit"
          >
            {row}
          </button>
        ) : (
          <div key={i}>{row}</div>
        );
      })}
    </div>
  );
}

export const CategoryChart = memo(CategoryChartComponent);
