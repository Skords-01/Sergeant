/**
 * Sergeant Routine — RoutineBottomNav (React Native)
 *
 * Mobile port of `apps/web/src/modules/routine/components/RoutineBottomNav.tsx`.
 *
 * Three-tab segmented control rendered at the bottom of the Routine
 * module shell. Mirrors the web component's 3 tabs (calendar / stats /
 * settings) and the same `RoutineMainTab` id space so the type is
 * compatible across platforms.
 *
 * Differences from web (intentional — see Phase 5 PR 1 body):
 *  - No dependency on a shared `ModuleBottomNav` primitive (web pulls it
 *    from `@shared/components/ui/ModuleBottomNav`). Mobile has no
 *    equivalent yet; we render the 3 buttons inline with NativeWind
 *    classes. Extract-to-shared is a follow-up once other modules
 *    (Finyk / Fizruk / Nutrition) port their own bottom navs.
 *  - Icons are emoji glyphs instead of inline SVG. A native SVG system
 *    (react-native-svg) lands with the Heatmap PR (Phase 5 PR 5); until
 *    then, emoji keeps the shell dependency-free.
 *  - 44×44 min tap targets per HIG / Material; respects
 *    `accessibilityRole="tab"` + `accessibilityState={{ selected }}`
 *    for VoiceOver / TalkBack parity with web's `role="tab"`.
 */

import { Pressable, Text, View } from "react-native";

import { hapticTap } from "@sergeant/shared";

export type RoutineMainTab = "calendar" | "stats" | "settings";

interface NavItem {
  id: RoutineMainTab;
  label: string;
  emoji: string;
}

const NAV: readonly NavItem[] = [
  { id: "calendar", label: "Календар", emoji: "📅" },
  { id: "stats", label: "Статистика", emoji: "📊" },
  { id: "settings", label: "Налаштування", emoji: "⚙️" },
];

export interface RoutineBottomNavProps {
  mainTab: RoutineMainTab;
  onSelectTab: (tab: RoutineMainTab) => void;
  /** Optional root `testID` — children derive stable sub-ids. */
  testID?: string;
}

export function RoutineBottomNav({
  mainTab,
  onSelectTab,
  testID,
}: RoutineBottomNavProps) {
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel="Розділи Рутини"
      testID={testID}
      className="flex-row items-stretch border-t border-cream-300 bg-cream-50"
    >
      {NAV.map((item) => {
        const selected = item.id === mainTab;
        return (
          <Pressable
            key={item.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={item.label}
            testID={testID ? `${testID}-${item.id}` : undefined}
            onPress={() => {
              if (selected) return;
              hapticTap();
              onSelectTab(item.id);
            }}
            className="flex-1 items-center justify-center py-2 min-h-[56px]"
          >
            <Text
              className={`text-xl ${selected ? "opacity-100" : "opacity-60"}`}
            >
              {item.emoji}
            </Text>
            <Text
              className={`text-[11px] mt-0.5 ${
                selected ? "text-coral-700 font-semibold" : "text-fg-muted"
              }`}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
