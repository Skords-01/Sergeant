/**
 * Sergeant Design System — Tabs (React Native)
 *
 * Mobile port of the web `Tabs` primitive. Provides a tablist with a
 * controlled `value` + `onChange` API across both style treatments
 * (`underline` and `pill`) and the module variant palette.
 *
 * @see apps/web/src/shared/components/ui/Tabs.tsx — canonical source of truth
 *
 * Differences from web (intentional):
 * - No roving-tabindex or arrow-key navigation (RN relies on touch /
 *   VoiceOver / TalkBack swipe navigation; the underlying tab array is
 *   flat with individual Pressable elements).
 * - Scrollable row uses a plain `<View>` (callers wrap in a
 *   `ScrollView horizontal` if they expect overflow).
 */

import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

export type TabsVariant =
  | "accent"
  | "finyk"
  | "fizruk"
  | "routine"
  | "nutrition";

export type TabsStyle = "underline" | "pill";

export type TabsSize = "sm" | "md";

export interface TabsItem<Value extends string = string> {
  value: Value;
  label: ReactNode;
  disabled?: boolean;
}

export interface TabsProps<Value extends string = string> {
  items: ReadonlyArray<TabsItem<Value>>;
  value: Value;
  onChange: (next: Value) => void;
  variant?: TabsVariant;
  style?: TabsStyle;
  size?: TabsSize;
  className?: string;
}

const pillActive: Record<TabsVariant, string> = {
  accent: "bg-success-soft",
  finyk: "bg-finyk-soft",
  fizruk: "bg-fizruk-soft",
  routine: "bg-routine-surface",
  nutrition: "bg-nutrition-soft",
};

const pillActiveText: Record<TabsVariant, string> = {
  accent: "text-success",
  finyk: "text-finyk",
  fizruk: "text-fizruk",
  routine: "text-routine",
  nutrition: "text-nutrition",
};

const underlineActiveBorder: Record<TabsVariant, string> = {
  accent: "border-b-2 border-accent",
  finyk: "border-b-2 border-finyk",
  fizruk: "border-b-2 border-fizruk",
  routine: "border-b-2 border-routine",
  nutrition: "border-b-2 border-nutrition",
};

const underlineActiveText: Record<TabsVariant, string> = pillActiveText;

const sizes: Record<TabsSize, string> = {
  sm: "h-9 px-3",
  md: "h-11 px-4",
};

const textSizes: Record<TabsSize, string> = {
  sm: "text-xs",
  md: "text-sm",
};

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function Tabs<Value extends string = string>({
  items,
  value,
  onChange,
  variant = "accent",
  style: tabStyle = "underline",
  size = "md",
  className,
}: TabsProps<Value>) {
  return (
    <View
      accessibilityRole="tablist"
      className={cx(
        "flex-row items-center",
        tabStyle === "pill" ? "bg-surface-muted rounded-xl p-1 gap-1" : "gap-1",
        tabStyle === "underline" ? "border-b border-line" : undefined,
        className,
      )}
    >
      {items.map((item) => {
        const isActive = item.value === value;
        const activeCls =
          tabStyle === "pill"
            ? cx(pillActive[variant], pillActiveText[variant])
            : cx(underlineActiveBorder[variant], underlineActiveText[variant]);
        const inactiveCls = cx(
          tabStyle === "pill"
            ? undefined
            : "-mb-px border-b-2 border-transparent",
          "text-fg-muted",
        );
        return (
          <Pressable
            key={item.value}
            accessibilityRole="tab"
            accessibilityState={{
              selected: isActive,
              disabled: Boolean(item.disabled),
            }}
            disabled={item.disabled}
            onPress={() => onChange(item.value)}
            className={cx(
              "items-center justify-center rounded-lg",
              sizes[size],
              isActive ? activeCls : inactiveCls,
              item.disabled ? "opacity-50" : undefined,
            )}
          >
            {typeof item.label === "string" ||
            typeof item.label === "number" ? (
              <Text
                className={cx(
                  "font-semibold",
                  textSizes[size],
                  isActive
                    ? tabStyle === "pill"
                      ? pillActiveText[variant]
                      : underlineActiveText[variant]
                    : "text-fg-muted",
                )}
              >
                {item.label}
              </Text>
            ) : (
              item.label
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
