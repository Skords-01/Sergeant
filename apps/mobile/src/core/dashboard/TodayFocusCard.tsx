/**
 * Mobile port of `apps/web/src/core/TodayFocusCard.tsx`.
 *
 * Shape mirrors the web version: one hero card that shows either the
 * current `focus` rec (primary CTA + optional dismiss) or an
 * empty-state prompt with module-tinted quick-add chips.
 *
 * Optional `coachInsight` — короткий AI-підзаголовок (як на web), якщо
 * `useCoachInsight` вже зібрав копію.
 *   - `focus.pwaAction` → `openHubModuleWithAction` wiring. Web's
 *     `hubNav` dispatches a custom DOM event caught by each module
 *     screen; mobile uses expo-router intent params (Phase 3) so for
 *     now the CTA just navigates via `onAction`.
 *   - Nutrition chip — hidden per the Phase-7 gate; mobile shows the
 *     three remaining modules (finyk / fizruk / routine).
 */

import { Pressable, Text, View } from "react-native";

import { hapticTap, type Rec } from "@sergeant/shared";

const MODULE_ACCENT_CLASS = {
  finyk: "bg-finyk",
  fizruk: "bg-fizruk",
  routine: "bg-routine",
  nutrition: "bg-nutrition",
  hub: "bg-brand-500",
} as const;

const MODULE_WASH_CLASS = {
  finyk: "bg-brand-50/60",
  fizruk: "bg-teal-50/60",
  routine: "bg-coral-50/60",
  nutrition: "bg-lime-50/60",
  hub: "bg-cream-100",
} as const;

const MODULE_OPEN_CTA = {
  finyk: "Відкрити Фінік",
  fizruk: "Відкрити Фізрук",
  routine: "Відкрити Рутину",
  nutrition: "Відкрити Харчування",
  hub: "Подивитись",
} as const;

const MODULE_CHIP_CLASS = {
  finyk: "bg-brand-50 border border-brand-200/60",
  fizruk: "bg-teal-50 border border-teal-200/60",
  routine: "bg-coral-50 border border-coral-300/60",
  nutrition: "bg-lime-50 border border-lime-200/60",
} as const;

const MODULE_CHIP_TEXT_CLASS = {
  finyk: "text-brand-700",
  fizruk: "text-teal-700",
  routine: "text-coral-700",
  nutrition: "text-lime-800",
} as const;

/**
 * Module-tinted quick-add chips shown in the empty state. Web renders
 * four (incl. nutrition), mobile is gated to three until Phase 7. The
 * `action` slot is preserved on the chip so future callers can still
 * derive a PWA-intent from it without recomputing here.
 */
interface QuickAddChip {
  module: "finyk" | "fizruk" | "routine";
  label: string;
}

const QUICK_ADD_CHIPS: QuickAddChip[] = [
  { module: "finyk", label: "Витрата" },
  { module: "routine", label: "Звичка" },
  { module: "fizruk", label: "Тренування" },
];

function EmptyFocus({
  onQuickAdd,
}: {
  onQuickAdd?: (module: QuickAddChip["module"]) => void;
}) {
  return (
    <View
      className="overflow-hidden rounded-2xl border border-cream-300 bg-cream-100/80 p-4"
      testID="today-focus-empty"
    >
      <View className="mb-2 flex-row items-center justify-between">
        {/* eslint-disable-next-line sergeant-design/no-eyebrow-drift -- intentional narrative eyebrow, mirrors web TodayFocusCard */}
        <Text className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
          Зараз
        </Text>
      </View>
      <Text className="text-base font-bold leading-snug text-stone-900">
        Що зафіксуємо?
      </Text>
      <Text className="mt-1 text-xs leading-relaxed text-stone-500">
        Один тап — один запис. Обери модуль і продовжуй.
      </Text>
      <View className="mt-3 flex-row flex-wrap gap-2">
        {QUICK_ADD_CHIPS.map((chip) => (
          <Pressable
            key={chip.module}
            accessibilityRole="button"
            accessibilityLabel={`Швидкий запис: ${chip.label}`}
            onPress={() => {
              hapticTap();
              onQuickAdd?.(chip.module);
            }}
            className={`flex-row items-center gap-1.5 rounded-full px-3 py-1.5 active:opacity-80 ${MODULE_CHIP_CLASS[chip.module]}`}
            testID={`today-focus-chip-${chip.module}`}
          >
            <Text
              className={`text-xs font-semibold ${MODULE_CHIP_TEXT_CLASS[chip.module]}`}
            >
              {chip.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export interface TodayFocusCardProps {
  focus: Rec | null;
  onAction: (module: string, focus: Rec) => void;
  onDismiss?: (id: string) => void;
  onQuickAdd?: (module: QuickAddChip["module"]) => void;
  /** Короткий AI-інсайт під рекомендацією (опційно). */
  coachInsight?: string | null;
}

/**
 * Primary hero on the mobile hub dashboard: one next-best-action
 * derived from the recommendation engine, or an action-driven empty
 * state when nothing is pending.
 */
export function TodayFocusCard({
  focus,
  onAction,
  onDismiss,
  onQuickAdd,
  coachInsight,
}: TodayFocusCardProps) {
  if (!focus) {
    return <EmptyFocus onQuickAdd={onQuickAdd} />;
  }

  const moduleKey = (focus.module as keyof typeof MODULE_ACCENT_CLASS) || "hub";
  const accent = MODULE_ACCENT_CLASS[moduleKey] ?? "bg-brand-500";
  const wash = MODULE_WASH_CLASS[moduleKey] ?? "bg-cream-100";
  const primaryLabel = MODULE_OPEN_CTA[moduleKey] ?? "Відкрити";

  return (
    <View
      className={`relative overflow-hidden rounded-2xl border border-cream-300 p-4 ${wash}`}
      testID={`today-focus-card-${focus.id}`}
    >
      <View
        className={`absolute bottom-4 left-0 top-4 w-1 rounded-r-full ${accent}`}
        accessibilityElementsHidden
      />

      <View className="pl-3">
        <View className="mb-1 flex-row items-center justify-between gap-3">
          {/* eslint-disable-next-line sergeant-design/no-eyebrow-drift -- intentional narrative eyebrow, mirrors web TodayFocusCard */}
          <Text className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
            Зараз
          </Text>
        </View>

        <Text className="text-base font-bold leading-snug text-stone-900">
          {focus.icon ? `${focus.icon} ` : ""}
          {focus.title}
        </Text>

        {focus.body ? (
          <Text className="mt-1 text-xs leading-relaxed text-stone-500">
            {focus.body}
          </Text>
        ) : null}

        {coachInsight ? (
          <Text className="mt-2 border-l-2 border-brand-500/40 pl-2 text-xs italic leading-relaxed text-stone-800">
            {coachInsight}
          </Text>
        ) : null}

        <View className="mt-3 flex-row flex-wrap items-center gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={primaryLabel}
            onPress={() => {
              hapticTap();
              onAction(focus.action, focus);
            }}
            className="flex-row items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 active:opacity-80"
            testID="today-focus-primary"
          >
            <Text className="text-xs font-semibold text-white">
              {primaryLabel}
            </Text>
            <Text className="text-xs font-semibold text-white">›</Text>
          </Pressable>
          {onDismiss ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Відкласти рекомендацію"
              onPress={() => onDismiss(focus.id)}
              className="ml-auto rounded-lg px-2.5 py-1.5 active:opacity-60"
              testID="today-focus-dismiss"
            >
              <Text className="text-xs font-medium text-stone-500">
                Пізніше
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}
