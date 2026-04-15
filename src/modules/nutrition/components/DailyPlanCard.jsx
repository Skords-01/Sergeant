import { useState } from "react";
import { Card } from "@shared/components/ui/Card";
import { Button } from "@shared/components/ui/Button";
import { Input } from "@shared/components/ui/Input";
import { cn } from "@shared/lib/cn";

const PRESETS = [
  {
    id: "cutting",
    label: "Схуднення",
    kcal: 1500,
    protein_g: 130,
    fat_g: 55,
    carbs_g: 130,
  },
  {
    id: "maintenance",
    label: "Підтримка",
    kcal: 2000,
    protein_g: 150,
    fat_g: 70,
    carbs_g: 200,
  },
  {
    id: "bulking",
    label: "Набір маси",
    kcal: 2700,
    protein_g: 200,
    fat_g: 90,
    carbs_g: 290,
  },
];

const MEAL_TYPE_ORDER = ["breakfast", "lunch", "dinner", "snack"];
const MEAL_TYPE_LABELS = {
  breakfast: "Сніданок",
  lunch: "Обід",
  dinner: "Вечеря",
  snack: "Перекус",
};
const MEAL_TYPE_ICONS = {
  breakfast: "☀️",
  lunch: "🥗",
  dinner: "🍽️",
  snack: "🍎",
};

function MacroBadge({ label, value, unit = "г", color }) {
  if (value == null) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] rounded-lg px-2 py-0.5",
        color || "bg-bg border border-line text-subtle"
      )}
    >
      <span className="font-semibold text-text">{Math.round(value)}</span>
      <span>{unit}</span>
      <span className="text-muted">{label}</span>
    </span>
  );
}

function MealRow({ meal, onAddToLog, onRegen, busy }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-2xl border border-line/60 bg-bg/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-base leading-none" aria-hidden>
              {MEAL_TYPE_ICONS[meal.type] || "🍴"}
            </span>
            <span className="text-[11px] font-bold text-nutrition/80 uppercase tracking-widest">
              {MEAL_TYPE_LABELS[meal.type] || meal.label}
            </span>
          </div>
          <div className="text-sm font-semibold text-text leading-tight">
            {meal.name}
          </div>
          {meal.description && (
            <div className="text-xs text-subtle mt-0.5 leading-snug">
              {meal.description}
            </div>
          )}
          <div className="flex flex-wrap gap-1 mt-1.5">
            {meal.kcal != null && (
              <MacroBadge
                label="ккал"
                value={meal.kcal}
                unit=""
                color="bg-nutrition/10 border border-nutrition/20 text-nutrition"
              />
            )}
            <MacroBadge label="Б" value={meal.protein_g} />
            <MacroBadge label="Ж" value={meal.fat_g} />
            <MacroBadge label="В" value={meal.carbs_g} />
          </div>
        </div>
        <div className="flex flex-col gap-1 shrink-0 items-end">
          <Button
            type="button"
            variant="ghost"
            className="h-8 text-xs px-2"
            onClick={() => onAddToLog(meal)}
            disabled={busy}
          >
            + Журнал
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-8 text-xs px-2 text-subtle"
            onClick={() => onRegen(meal.type)}
            disabled={busy}
          >
            ↻ Замінити
          </Button>
        </div>
      </div>
      {meal.ingredients?.length > 0 && (
        <button
          type="button"
          className="mt-2 text-[11px] text-nutrition/70 hover:text-nutrition transition-colors"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "▲ Сховати інгредієнти" : "▼ Інгредієнти"}
        </button>
      )}
      {expanded && meal.ingredients?.length > 0 && (
        <ul className="mt-1.5 text-xs text-text list-disc pl-4 space-y-0.5">
          {meal.ingredients.map((ing, i) => (
            <li key={i}>{ing}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DailyPlanCard({
  prefs,
  setPrefs,
  pantryItems,
  busy,
  dayPlan,
  dayPlanBusy,
  fetchDayPlan,
  regenMeal,
  addMealToLog,
}) {
  const [showManual, setShowManual] = useState(false);

  const activePreset = PRESETS.find(
    (p) =>
      p.kcal === prefs.dailyTargetKcal &&
      p.protein_g === prefs.dailyTargetProtein_g &&
      p.fat_g === prefs.dailyTargetFat_g &&
      p.carbs_g === prefs.dailyTargetCarbs_g
  );

  const applyPreset = (preset) => {
    setPrefs((p) => ({
      ...p,
      dailyTargetKcal: preset.kcal,
      dailyTargetProtein_g: preset.protein_g,
      dailyTargetFat_g: preset.fat_g,
      dailyTargetCarbs_g: preset.carbs_g,
    }));
  };

  const hasTargets = prefs.dailyTargetKcal != null;

  const sortedMeals = dayPlan?.meals
    ? [...dayPlan.meals].sort(
        (a, b) =>
          MEAL_TYPE_ORDER.indexOf(a.type) - MEAL_TYPE_ORDER.indexOf(b.type)
      )
    : [];

  return (
    <Card className="p-4">
      <div className="text-sm font-semibold text-text">Денний план</div>
      <div className="text-xs text-subtle mt-0.5">
        AI генерує персоналізований план прийомів їжі з урахуванням твоїх цілей
        та продуктів зі складу.
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <div className="text-[11px] text-subtle mb-2">
            Пресет або ручні цілі
          </div>
          <div className="flex gap-2 flex-wrap">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                disabled={busy || dayPlanBusy}
                className={cn(
                  "flex-1 min-w-[90px] py-2 px-3 rounded-xl text-xs font-semibold border transition-all",
                  activePreset?.id === preset.id
                    ? "bg-nutrition text-white border-nutrition"
                    : "border-line text-text hover:border-nutrition/50 hover:bg-nutrition/5"
                )}
              >
                <div>{preset.label}</div>
                <div className="text-[10px] opacity-70 mt-0.5">
                  ~{preset.kcal} ккал
                </div>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowManual((v) => !v)}
              disabled={busy || dayPlanBusy}
              className={cn(
                "flex-1 min-w-[90px] py-2 px-3 rounded-xl text-xs font-semibold border transition-all",
                showManual && !activePreset
                  ? "bg-panel border-nutrition text-text"
                  : "border-line text-subtle hover:border-nutrition/50 hover:text-text"
              )}
            >
              Свої цілі
            </button>
          </div>

          {showManual && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                { key: "dailyTargetKcal", label: "Ккал", unit: "" },
                { key: "dailyTargetProtein_g", label: "Білки", unit: "г" },
                { key: "dailyTargetFat_g", label: "Жири", unit: "г" },
                { key: "dailyTargetCarbs_g", label: "Вуглеводи", unit: "г" },
              ].map(({ key, label, unit }) => (
                <div key={key}>
                  <div className="text-[11px] text-subtle mb-1">
                    {label}
                    {unit && ` (${unit})`}
                  </div>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={prefs[key] != null ? String(prefs[key]) : ""}
                    onChange={(e) => {
                      const v =
                        e.target.value === ""
                          ? null
                          : Number(e.target.value) > 0
                          ? Number(e.target.value)
                          : null;
                      setPrefs((p) => ({ ...p, [key]: v }));
                    }}
                    placeholder="—"
                    disabled={busy || dayPlanBusy}
                  />
                </div>
              ))}
            </div>
          )}

          {hasTargets && (
            <div className="mt-2 flex flex-wrap gap-1">
              {prefs.dailyTargetKcal != null && (
                <span className="text-[11px] bg-nutrition/10 text-nutrition border border-nutrition/20 rounded-lg px-2 py-0.5">
                  {prefs.dailyTargetKcal} ккал
                </span>
              )}
              {prefs.dailyTargetProtein_g != null && (
                <span className="text-[11px] bg-bg border border-line rounded-lg px-2 py-0.5 text-subtle">
                  Б: {prefs.dailyTargetProtein_g}г
                </span>
              )}
              {prefs.dailyTargetFat_g != null && (
                <span className="text-[11px] bg-bg border border-line rounded-lg px-2 py-0.5 text-subtle">
                  Ж: {prefs.dailyTargetFat_g}г
                </span>
              )}
              {prefs.dailyTargetCarbs_g != null && (
                <span className="text-[11px] bg-bg border border-line rounded-lg px-2 py-0.5 text-subtle">
                  В: {prefs.dailyTargetCarbs_g}г
                </span>
              )}
              <button
                type="button"
                className="text-[11px] text-muted hover:text-danger transition-colors px-1"
                onClick={() =>
                  setPrefs((p) => ({
                    ...p,
                    dailyTargetKcal: null,
                    dailyTargetProtein_g: null,
                    dailyTargetFat_g: null,
                    dailyTargetCarbs_g: null,
                  }))
                }
              >
                ✕ Скинути
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={fetchDayPlan}
          disabled={busy || dayPlanBusy}
          className={cn(
            "w-full h-11 rounded-2xl text-sm font-semibold",
            "bg-nutrition text-white hover:bg-nutrition-hover disabled:opacity-50 transition-colors"
          )}
        >
          {dayPlanBusy ? "Генерую план…" : "Згенерувати денний план"}
        </button>

        {pantryItems?.length === 0 && (
          <div className="text-xs text-subtle text-center -mt-2">
            Додай продукти на склад — AI врахує їх у плані
          </div>
        )}

        {sortedMeals.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-text">Ваш план на сьогодні</div>
              {dayPlan?.totalKcal != null && (
                <span className="text-xs text-subtle">
                  ~{Math.round(dayPlan.totalKcal)} ккал разом
                </span>
              )}
            </div>

            {dayPlan?.totalKcal != null && prefs.dailyTargetKcal != null && (
              <div className="rounded-xl bg-panel border border-line px-3 py-2">
                <div className="flex justify-between text-[11px] text-subtle mb-1">
                  <span>Прогрес до цілі</span>
                  <span>
                    {Math.round(dayPlan.totalKcal)} /{" "}
                    {prefs.dailyTargetKcal} ккал
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-line overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      dayPlan.totalKcal > prefs.dailyTargetKcal * 1.1
                        ? "bg-danger"
                        : "bg-nutrition"
                    )}
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(
                          (dayPlan.totalKcal / prefs.dailyTargetKcal) * 100
                        )
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              {sortedMeals.map((meal, i) => (
                <MealRow
                  key={`${meal.type}_${i}`}
                  meal={meal}
                  onAddToLog={addMealToLog}
                  onRegen={regenMeal}
                  busy={busy || dayPlanBusy}
                />
              ))}
            </div>

            {dayPlan?.note && (
              <div className="rounded-xl bg-panel/60 border border-line/60 px-3 py-2 text-xs text-subtle">
                {dayPlan.note}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
