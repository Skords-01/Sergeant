/**
 * Canonical list of Fizruk measurement fields available on the mobile
 * port. Ordering drives the form and "latest values" UI.
 *
 * Scope note: the web `MEASURE_FIELDS` list in
 * `apps/web/src/modules/fizruk/hooks/useMeasurements.ts` is wider
 * (separate left/right biceps, forearm, thigh, calf, neck, body-fat).
 * Phase 6 deliberately trims the mobile set to the high-signal fields
 * listed in the migration plan: core weight + top body-part
 * circumferences + wellbeing scores. New fields can be added here
 * without touching the screens (the form + list iterate this array).
 */

import type { MeasurementFieldDef, MeasurementFieldId } from "./types.js";

export const MEASUREMENT_FIELDS: readonly MeasurementFieldDef[] = [
  { id: "weightKg", label: "Вага", unit: "кг", min: 20, max: 400 },
  { id: "waistCm", label: "Талія", unit: "см", min: 30, max: 300 },
  { id: "chestCm", label: "Груди", unit: "см", min: 30, max: 300 },
  { id: "hipsCm", label: "Стегна", unit: "см", min: 30, max: 300 },
  { id: "bicepCm", label: "Біцепс", unit: "см", min: 10, max: 100 },
  { id: "sleepHours", label: "Сон", unit: "год", min: 0, max: 24 },
  {
    id: "energyLevel",
    label: "Енергія",
    unit: "/5",
    min: 1,
    max: 5,
    integer: true,
  },
  {
    id: "mood",
    label: "Настрій",
    unit: "/5",
    min: 1,
    max: 5,
    integer: true,
  },
] as const;

/** Convenience: just the ids, in declaration order. */
export const MEASUREMENT_FIELD_IDS: readonly MeasurementFieldId[] =
  MEASUREMENT_FIELDS.map((f) => f.id);

/** O(1) lookup helper for callers that only have an id in hand. */
export function getMeasurementFieldDef(
  id: MeasurementFieldId,
): MeasurementFieldDef {
  const def = MEASUREMENT_FIELDS.find((f) => f.id === id);
  if (!def) {
    throw new Error(`Unknown measurement field id: ${String(id)}`);
  }
  return def;
}
