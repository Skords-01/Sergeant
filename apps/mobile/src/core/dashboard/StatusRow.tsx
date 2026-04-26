/**
 * Sergeant Hub — StatusRow (mobile)
 *
 * Single row in the mobile dashboard's module list. Visual layout
 * mirrors the web `StatusRow` inside `apps/web/src/core/hub/HubDashboard.tsx`:
 * accent bar → icon tile → label + description → **quick-stats preview**
 * → chevron. The preview section renders:
 *   - `main` — a primary figure rendered bold-right of the label/body,
 *   - `sub`  — a secondary caption rendered under `main`,
 *   - optional `progress` (0–100) — a thin bar below the text pair,
 *     only shown for goal-bearing modules (`routine`, `nutrition`).
 *
 * The preview object itself is computed upstream (see
 * `HubDashboard.useModulePreviews`) by the pure `selectModulePreview`
 * helper from `@sergeant/shared`, so this component stays presentational
 * and testable with plain prop fixtures.
 *
 * Rendering is memoised because the dashboard re-renders on every
 * MMKV-backed write to the order key and each row's render cost
 * includes a small tree of native views.
 */

import { memo } from "react";
import { Pressable, Text, View } from "react-native";

import type { DashboardModuleId, ModulePreview } from "@sergeant/shared";

import { DASHBOARD_MODULE_RENDER } from "./dashboardModuleConfig";

export interface StatusRowProps {
  id: DashboardModuleId;
  onPress?: (id: DashboardModuleId) => void;
  disabled?: boolean;
  testID?: string;
  /**
   * Preview stats for this row (or `null` if none available / writers
   * haven't landed yet). The component gracefully renders only the
   * non-null parts so a half-populated payload doesn't leave visual
   * gaps.
   */
  preview?: ModulePreview | null;
}

/** Clamp a loose percentage to the [0, 100] bounds used by the bar. */
function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

function hasPreviewContent(preview: ModulePreview | null | undefined): boolean {
  if (!preview) return false;
  if (preview.main || preview.sub) return true;
  if (typeof preview.progress === "number" && preview.progress > 0) return true;
  return false;
}

export const StatusRow = memo(function StatusRow({
  id,
  onPress,
  disabled,
  testID,
  preview,
}: StatusRowProps) {
  const config = DASHBOARD_MODULE_RENDER[id];
  const showPreview = hasPreviewContent(preview);
  const showProgress = showPreview && typeof preview?.progress === "number";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${config.label}: ${config.description}`}
      accessibilityHint="Двічі торкнись, щоб відкрити модуль. Утримай і потягни, щоб змінити порядок."
      accessibilityState={{ disabled: Boolean(disabled) }}
      onPress={() => onPress?.(id)}
      disabled={disabled}
      testID={testID ?? `dashboard-row-${id}`}
      className="flex-row items-stretch overflow-hidden rounded-2xl border border-cream-300 bg-cream-50 active:opacity-80"
    >
      <View className={`w-1.5 ${config.accentClass}`} />
      <View className="flex-1 flex-row items-center gap-3 px-3 py-3">
        <View
          className={`h-11 w-11 items-center justify-center rounded-xl ${config.iconBgClass}`}
        >
          <Text className="text-xl">{config.glyph}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-base font-semibold text-fg" numberOfLines={1}>
            {config.label}
          </Text>
          <Text className="text-xs text-fg-muted" numberOfLines={1}>
            {config.description}
          </Text>
          {showProgress ? (
            <View
              accessibilityRole="progressbar"
              accessibilityValue={{
                now: clampProgress(preview!.progress ?? 0),
              }}
              testID={`dashboard-row-${id}-progress`}
              className="mt-1 h-1 overflow-hidden rounded-full bg-cream-200"
            >
              <View
                style={{
                  width: `${clampProgress(preview!.progress ?? 0)}%`,
                }}
                className={`h-full ${config.accentClass}`}
              />
            </View>
          ) : null}
        </View>
        {showPreview ? (
          <View
            className="ml-1 max-w-[44%] items-end"
            testID={`dashboard-row-${id}-preview`}
          >
            {preview?.main ? (
              <Text className="text-sm font-semibold text-fg" numberOfLines={1}>
                {preview.main}
              </Text>
            ) : null}
            {preview?.sub ? (
              <Text className="text-[11px] text-fg-muted" numberOfLines={1}>
                {preview.sub}
              </Text>
            ) : null}
          </View>
        ) : null}
        <Text className="text-fg-subtle text-lg">›</Text>
      </View>
    </Pressable>
  );
});
