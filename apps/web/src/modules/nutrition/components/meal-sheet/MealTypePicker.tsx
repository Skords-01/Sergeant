import { cn } from "@shared/lib/cn";
import { SectionHeading } from "@shared/components/ui/SectionHeading";
import { MEAL_TYPES } from "../../lib/mealTypes";

export function MealTypePicker({ mealType, setForm }) {
  return (
    <div className="mb-4">
      <SectionHeading as="div" size="xs" className="mb-2">
        Прийом їжі
      </SectionHeading>
      <div className="flex gap-2 flex-wrap">
        {MEAL_TYPES.map((mt) => (
          <button
            key={mt.id}
            type="button"
            onClick={() => setForm((s) => ({ ...s, mealType: mt.id }))}
            className={cn(
              "px-3 py-1.5 rounded-xl text-sm font-semibold border transition-[background-color,border-color,color,opacity]",
              mealType === mt.id
                ? "bg-nutrition-strong text-white border-nutrition"
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
