import { cn } from "@shared/lib/cn";

export function FromPantryRow({
  pantryItems,
  fromPantryItem,
  setFromPantryItem,
  setForm,
  setFoodQuery,
}) {
  if (!pantryItems || pantryItems.length === 0) return null;
  return (
    <div className="mb-4 rounded-2xl border border-line/50 bg-panel/40 px-3 py-3">
      <div className="text-[10px] font-bold text-subtle uppercase tracking-widest mb-2">
        Зі складу
        {fromPantryItem && (
          <span className="ml-2 text-nutrition font-semibold normal-case tracking-normal">
            · {fromPantryItem}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {pantryItems.slice(0, 20).map((item) => {
          const isActive = fromPantryItem === item.name;
          return (
            <button
              key={item.name}
              type="button"
              onClick={() => {
                if (isActive) {
                  setFromPantryItem(null);
                  setForm((s) => ({
                    ...s,
                    name: s.name === item.name ? "" : s.name,
                  }));
                } else {
                  setFromPantryItem(item.name);
                  setForm((s) => ({ ...s, name: item.name, err: "" }));
                  setFoodQuery(item.name);
                }
              }}
              className={cn(
                "px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all",
                isActive
                  ? "bg-nutrition text-white border-nutrition"
                  : "bg-panelHi text-text border-line hover:border-nutrition/50",
              )}
            >
              {item.name}
              {item.qty != null && (
                <span className="ml-1 text-[10px] opacity-70">
                  {item.qty}
                  {item.unit || "г"}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
