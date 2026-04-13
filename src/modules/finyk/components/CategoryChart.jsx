const COLORS = ["#818cf8","#34d399","#f59e0b","#f87171","#60a5fa","#c084fc","#fb923c","#4ade80"];

export function CategoryChart({ data, onBarClick }) {
  const maxVal = data[0]?.spent || 1;
  return (
    <div className="flex flex-col gap-3">
      {data.map((cat, i) => (
        <div
          key={i}
          onClick={onBarClick ? () => onBarClick(cat.id) : undefined}
          className={onBarClick ? "cursor-pointer group" : undefined}
        >
          <div className="flex justify-between mb-1.5">
            <span className="text-xs text-muted group-hover:text-text transition-colors">{cat.label.split(" ")[0]} {cat.label.slice(3)}</span>
            <span className="text-xs font-bold">−{cat.spent.toLocaleString("uk-UA")} ₴</span>
          </div>
          <div className="h-1.5 bg-line rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${(cat.spent / maxVal) * 100}%`, background: COLORS[i % COLORS.length] }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
