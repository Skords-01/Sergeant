/**
 * `BodyTrendCard` — single card in the Fizruk Body dashboard that
 * wraps `TrendChart` with a small header + empty/collapsed states.
 *
 * Web counterpart: each `<MiniLineChart/>` inside a `<Card/>` in
 * `apps/web/src/modules/fizruk/pages/Body.tsx`. The mobile port reuses
 * the already-shipped `TrendChart` from `../progress` rather than
 * pulling in a second chart renderer.
 */
import { memo } from "react";
import { Text, View } from "react-native";

import {
  buildMeasurementSeries,
  type MeasurementFieldId,
  type MobileMeasurementEntry,
  type ProgressMeasurementInput,
} from "@sergeant/fizruk-domain/domain";

import { TrendChart } from "../progress/TrendChart";

export interface BodyTrendCardProps {
  /** Card heading shown above the chart (e.g. "Динаміка ваги"). */
  title: string;
  /** Which measurement field to chart. */
  field: MeasurementFieldId;
  /** Stroke colour (hex / `rgb(…)`) — same contract as TrendChart. */
  strokeColor: string;
  /** Unit suffix for the latest-value header (`" кг"`, `"/5"`, …). */
  unit: string;
  /** Descriptive metric label for empty-state copy ("вагу", "сон"). */
  metricLabel: string;
  /** Raw newest-first entries from `useMeasurements()`. */
  entries: readonly MobileMeasurementEntry[];
  /** Window length (number of points to plot). Defaults to 8. */
  limit?: number;
  /** testID root; TrendChart adds `-chart` / `-empty` suffixes itself. */
  testID?: string;
}

/**
 * `MobileMeasurementEntry` is a structural subset of
 * `ProgressMeasurementInput` but does not declare the latter's open
 * index signature. Spreading through a plain object lets the trend
 * builder consume our entries without widening the persisted type.
 * Mirrors the same helper in `MeasurementsTrendCard`.
 */
function toProgressInputs(
  entries: readonly MobileMeasurementEntry[],
): ProgressMeasurementInput[] {
  return entries.map((e) => ({ ...e }));
}

const BodyTrendCardImpl = function BodyTrendCard({
  title,
  field,
  strokeColor,
  unit,
  metricLabel,
  entries,
  limit,
  testID,
}: BodyTrendCardProps) {
  const series = buildMeasurementSeries(
    toProgressInputs(entries),
    field,
    limit,
  );
  const rootTestID = testID ?? `fizruk-body-trend-${field}`;

  return (
    <View
      className="rounded-2xl bg-cream-50 border border-cream-200 p-4"
      testID={rootTestID}
      accessibilityLabel={`Динаміка: ${metricLabel}`}
    >
      <View className="flex-row items-baseline justify-between mb-2">
        <Text className="text-sm font-semibold text-stone-900">{title}</Text>
        <Text className="text-[11px] text-stone-500">
          {`останні ${limit ?? 8}`}
        </Text>
      </View>
      <TrendChart
        series={series}
        strokeColor={strokeColor}
        unit={unit}
        metricLabel={metricLabel}
        testIDPrefix={rootTestID}
      />
    </View>
  );
};

export const BodyTrendCard = memo(BodyTrendCardImpl);
