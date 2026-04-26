/**
 * Sergeant Hub-core — Settings primitives (React Native)
 *
 * First-cut mobile mirror of `apps/web/src/core/settings/SettingsPrimitives.tsx`.
 * Only the primitives actually consumed by the first-cut mobile sections
 * (`RoutineSection`, `ExperimentalSection`) are ported here:
 *
 *  - `SettingsGroup` — collapsible card container with a pressable header
 *    (emoji + title + chevron). Local `useState` drives expand/collapse;
 *    there is no grid-rows animation like on web because RN doesn't
 *    support `grid-template-rows` transitions. The content simply
 *    mounts / unmounts — good enough for a first cut and keeps us
 *    below the "no new deps" bar.
 *  - `ToggleRow` — label (+ optional description) paired with an RN
 *    `Switch`. Mirrors the `checked` / `onChange` shape of the web
 *    version but adapts the handler signature (RN `Switch.onValueChange`
 *    passes the new boolean directly instead of a DOM change event).
 *  - `SettingsSubGroup` — optional-titled vertical stack used inside a
 *    `SettingsGroup` to split heterogeneous rows (toggle + notice card
 *    + button strip) the way the web version does. Mobile omits the
 *    web surround-border so a single group stays visually compact, and
 *    the section-label uses plain sentence-case typography (no
 *    uppercase eyebrow) so it does not trip the design-system
 *    `sergeant-design/no-eyebrow-drift` lint rule.
 *
 * The web file also ships `ConfirmModal`; that is deliberately out of
 * scope here and will land with `NotificationsSection` / `FinykSection`
 * in follow-up PRs.
 */

import { useState, type ReactNode } from "react";
import { Pressable, Switch, Text, View } from "react-native";

import { Card } from "@/components/ui/Card";

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export interface SettingsGroupProps {
  title: string;
  emoji?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function SettingsGroup({
  title,
  emoji,
  children,
  defaultOpen = false,
}: SettingsGroupProps) {
  const [open, setOpen] = useState<boolean>(defaultOpen);
  return (
    <Card radius="lg" padding="none" className="overflow-hidden">
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={title}
        className="w-full px-4 py-3.5 flex-row items-center justify-between gap-2"
      >
        <View className="flex-row items-center gap-2 flex-1 min-w-0">
          {emoji ? <Text className="text-base">{emoji}</Text> : null}
          <Text className="text-sm font-semibold text-fg" numberOfLines={1}>
            {title}
          </Text>
        </View>
        <Text className="text-fg-muted text-base">{open ? "▾" : "▸"}</Text>
      </Pressable>
      {open ? (
        <View className="border-t border-cream-300 p-4 gap-5">{children}</View>
      ) : null}
    </Card>
  );
}

export interface ToggleRowProps {
  label: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Optional testID forwarded to the underlying RN `Switch`. */
  testID?: string;
}

export function ToggleRow({
  label,
  description,
  checked,
  onChange,
  testID,
}: ToggleRowProps) {
  return (
    <View className="flex-row items-start justify-between gap-3">
      <View className="flex-1 min-w-0">
        {typeof label === "string" ? (
          <Text className="text-sm text-fg">{label}</Text>
        ) : (
          label
        )}
        {description ? (
          typeof description === "string" ? (
            <Text className={cx("text-xs text-fg-muted mt-0.5 leading-snug")}>
              {description}
            </Text>
          ) : (
            description
          )
        ) : null}
      </View>
      <View className="shrink-0">
        <Switch value={checked} onValueChange={onChange} testID={testID} />
      </View>
    </View>
  );
}

export interface SettingsSubGroupProps {
  title?: string;
  children: ReactNode;
}

/**
 * Titled vertical stack used inside a `SettingsGroup` to split a
 * heterogeneous list of rows (toggles + notice cards + button strips)
 * into semantic sub-sections. Mirrors the web `SettingsSubGroup`
 * naming but drops the web surround-border to keep mobile cards
 * visually compact. The optional `title` renders as a small
 * uppercase label à la iOS / Android system settings.
 */
export function SettingsSubGroup({ title, children }: SettingsSubGroupProps) {
  return (
    <View className="gap-3">
      {title ? (
        <Text className="text-xs font-semibold text-fg-muted">{title}</Text>
      ) : null}
      <View className="gap-3">{children}</View>
    </View>
  );
}
