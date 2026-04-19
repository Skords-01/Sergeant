import { useEffect, useMemo } from "react";
import { cn } from "@shared/lib/cn";
import { Icon } from "@shared/components/ui/Icon";
import { Sheet } from "@shared/components/ui/Sheet";
import { openHubModuleWithAction } from "@shared/lib/hubNav";
import { trackEvent, ANALYTICS_EVENTS } from "../analytics";
import { applyPreset } from "./presetApply.js";

/**
 * Per-module "tap-to-log" presets. Each entry is deliberately narrow —
 * 3 presets is the sweet spot where the list feels opinionated (not
 * overwhelming) but still has enough spread that a real person sees
 * themselves in at least one option.
 *
 * Presets are the single lowest-friction path to a real (non-demo)
 * entry: tapping one writes straight to the module's storage, no form,
 * no wizard. The custom-entry row at the bottom of the sheet keeps the
 * escape hatch for users whose first instinct doesn't fit the list.
 */
const PRESETS = {
  routine: {
    title: "Яку звичку почнемо?",
    desc: "Одне натискання — і вона у твоєму списку сьогодні.",
    accent: "text-routine bg-routine-soft",
    moduleIcon: "check",
    fallback: { action: "add_habit", label: "Своя звичка", icon: "plus" },
    items: [
      {
        id: "water",
        emoji: "💧",
        title: "Випити воду",
        desc: "Щодня, будь-коли",
        data: { name: "Випити воду", emoji: "💧" },
      },
      {
        id: "walk",
        emoji: "🚶",
        title: "Пройти 10 хв",
        desc: "Короткий вихід після обіду",
        data: { name: "Пройти 10 хв", emoji: "🚶" },
      },
      {
        id: "read",
        emoji: "📖",
        title: "Прочитати 10 сторінок",
        desc: "Вечірня звичка",
        data: { name: "Прочитати 10 сторінок", emoji: "📖" },
      },
    ],
  },
  finyk: {
    title: "На що витратив?",
    desc: "Занотую миттєво. Суму можна змінити потім.",
    accent: "text-finyk bg-finyk-soft",
    moduleIcon: "credit-card",
    fallback: { action: "add_expense", label: "Інша сума", icon: "plus" },
    items: [
      {
        id: "coffee",
        emoji: "☕",
        title: "Кава",
        desc: "95 ₴ · їжа",
        data: { description: "Кава", amount: 95, category: "їжа" },
      },
      {
        id: "ride",
        emoji: "🚕",
        title: "Таксі",
        desc: "180 ₴ · транспорт",
        data: { description: "Таксі", amount: 180, category: "транспорт" },
      },
      {
        id: "lunch",
        emoji: "🥗",
        title: "Обід",
        desc: "220 ₴ · їжа",
        data: { description: "Обід", amount: 220, category: "їжа" },
      },
    ],
  },
  nutrition: {
    title: "Що з'їв зараз?",
    desc: "Калорії й макро — вже прораховано.",
    accent: "text-nutrition bg-nutrition-soft",
    moduleIcon: "utensils",
    fallback: { action: "add_meal", label: "Інша страва", icon: "plus" },
    items: [
      {
        id: "omelette",
        emoji: "🍳",
        title: "Омлет з авокадо",
        desc: "~420 ккал · сніданок",
        data: { name: "Омлет з авокадо", kcal: 420, mealType: "breakfast" },
      },
      {
        id: "salad",
        emoji: "🥗",
        title: "Салат з куркою",
        desc: "~380 ккал · обід",
        data: { name: "Салат з куркою", kcal: 380, mealType: "lunch" },
      },
      {
        id: "snack",
        emoji: "🍎",
        title: "Яблуко + горіхи",
        desc: "~220 ккал · перекус",
        data: { name: "Яблуко + горіхи", kcal: 220, mealType: "snack" },
      },
    ],
  },
  fizruk: {
    title: "Швидкий старт",
    desc: "Залогую як завершене тренування. Деталі — потім.",
    accent: "text-fizruk bg-fizruk-soft",
    moduleIcon: "dumbbell",
    fallback: {
      action: "start_workout",
      label: "Повне тренування",
      icon: "plus",
    },
    items: [
      {
        id: "warmup",
        emoji: "🤸",
        title: "Розминка",
        desc: "10 хв · легко",
        data: { name: "Розминка", durationMin: 10 },
      },
      {
        id: "walk",
        emoji: "🚶",
        title: "Прогулянка",
        desc: "25 хв · кардіо",
        data: { name: "Прогулянка", durationMin: 25 },
      },
      {
        id: "quick",
        emoji: "⚡",
        title: "Швидке HIIT",
        desc: "15 хв · інтенсив",
        data: { name: "Швидке HIIT", durationMin: 15 },
      },
    ],
  },
};

export function getPresetModule(moduleId) {
  return PRESETS[moduleId] || null;
}

/**
 * Bottom-sheet list of "one-tap" presets for a single module. Tapping a
 * preset writes a real entry straight into the module's storage, fires
 * `FIRST_REAL_ENTRY` on the next hub render, and closes the sheet —
 * that is the 30-second FTUX success moment in one interaction.
 *
 * The "custom" fallback row deep-links into the module's full input
 * flow (same PWA action the old FirstActionRow used) for users whose
 * first entry isn't in the preset list.
 */
export function PresetSheet({ open, moduleId, onClose, onPick }) {
  const config = useMemo(() => PRESETS[moduleId] || null, [moduleId]);

  useEffect(() => {
    if (!open || !config) return;
    trackEvent(ANALYTICS_EVENTS.FTUX_PRESET_SHEET_SHOWN, {
      module: moduleId,
      presetCount: config.items.length,
    });
  }, [open, config, moduleId]);

  if (!config) return null;

  const handlePick = (item) => {
    trackEvent(ANALYTICS_EVENTS.FTUX_PRESET_PICKED, {
      module: moduleId,
      presetId: item.id,
    });
    applyPreset(moduleId, item.data);
    onPick?.({ moduleId, presetId: item.id });
    onClose?.();
  };

  const handleCustom = () => {
    trackEvent(ANALYTICS_EVENTS.FTUX_PRESET_CUSTOM, {
      module: moduleId,
      via: "fallback",
    });
    onPick?.({ moduleId, presetId: null, custom: true });
    onClose?.();
    openHubModuleWithAction(moduleId, config.fallback.action);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={config.title}
      description={config.desc}
    >
      <div className="px-5 pb-5 space-y-2">
        {config.items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => handlePick(item)}
            className={cn(
              "w-full text-left px-3 py-3 rounded-2xl border border-line bg-panelHi",
              "hover:border-brand-500/50 hover:bg-brand-500/5 transition-all",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/45",
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "w-11 h-11 shrink-0 rounded-xl flex items-center justify-center text-xl",
                  config.accent,
                )}
                aria-hidden
              >
                <span>{item.emoji}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-text truncate">
                  {item.title}
                </div>
                <div className="text-xs text-muted mt-0.5 truncate">
                  {item.desc}
                </div>
              </div>
              <Icon
                name="chevron-right"
                size={16}
                className="text-muted shrink-0"
              />
            </div>
          </button>
        ))}

        <button
          type="button"
          onClick={handleCustom}
          className={cn(
            "w-full text-center px-3 py-3 rounded-2xl border border-dashed border-line",
            "text-sm font-semibold text-muted hover:text-text hover:border-brand-500/50",
            "transition-all",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/45",
          )}
        >
          <div className="flex items-center justify-center gap-1.5">
            <Icon name={config.fallback.icon} size={14} />
            <span>{config.fallback.label}</span>
          </div>
        </button>
      </div>
    </Sheet>
  );
}
