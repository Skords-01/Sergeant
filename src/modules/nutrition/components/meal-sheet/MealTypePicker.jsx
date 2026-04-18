import { cn } from "@shared/lib/cn";
import { MEAL_TYPES } from "../../lib/mealTypes.js";

export function MealTypePicker({ mealType, setForm }) {
  return (
    <div className="mb-4">
      <div className="text-[10px] font-bold text-subtle uppercase tracking-widest mb-2">
        Прийом їжі
      </div>
      <div className="flex gap-2 flex-wrap">
        {MEAL_TYPES.map((mt) => (
          <button
            key={mt.id}
            type="button"
            onClick={() => setForm((s) => ({ ...s, mealType: mt.id }))}
            className={cn(
              "px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all",
              mealType === mt.id
                ? "bg-nutrition text-white border-nutrition"
                : "bg-panelHi text-muted border-line hover:border-nutrition/50",
            )}
          >
            {mt.emoji} {mt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
