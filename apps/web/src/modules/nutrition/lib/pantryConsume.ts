/**
 * Last validated: 2026-06-15
 * Status: Active
 *
 * UOM / density conversion for pantry consumption (page-audit-08 F15).
 *
 * `consumePantryItem` knows only how many *grams* were eaten (the AddMeal
 * sheet always passes a gram amount). Pantry stock, however, can be stored in
 * volume (мл/л) or count (шт) units. To deduct from those without drifting the
 * inventory we convert the consumed grams into the item's own unit using a
 * small density / portion-weight table keyed on the (normalised) food name,
 * with conservative defaults when the food is unknown.
 *
 * Returns the quantity to subtract *in the item's unit*, or `null` when no
 * sensible conversion exists (e.g. `уп`/`пач` packs, where one "package" has
 * no fixed gram weight) — callers then leave the item untouched, matching the
 * pre-F15 behaviour for unconvertible units.
 */
import { normalizeFoodName, normalizeUnit } from "./pantryTextParser";

// Density in grams per millilitre. Default 1.0 g/ml (water-like) covers most
// thin liquids; entries override where the difference is material to stock
// accuracy. Keys are normalised food names (see `normalizeFoodName`).
const DENSITY_G_PER_ML = new Map<string, number>([
  ["молоко", 1.03],
  ["кефір", 1.03],
  ["вершки", 1.01],
  ["йогурт", 1.03],
  ["олія", 0.92],
  ["оливкова олія", 0.92],
  ["мед", 1.42],
  ["сметана", 1.0],
  ["сік", 1.05],
  ["вода", 1.0],
]);
const DEFAULT_DENSITY_G_PER_ML = 1.0;

// Average edible weight of one piece, in grams. Used to convert eaten grams
// into a `шт` count. Default 100 g/шт is deliberately coarse — count-based
// stock is approximate by nature; named entries pin the common cases.
const PIECE_WEIGHT_G = new Map<string, number>([
  ["яйце", 60],
  ["яйця", 60],
  ["яйцо", 60],
  ["банан", 120],
  ["яблуко", 180],
  ["апельсин", 200],
  ["картопля", 150],
  ["цибуля", 110],
  ["морква", 80],
  ["помідор", 120],
  ["огірок", 100],
  ["лимон", 100],
]);
const DEFAULT_PIECE_WEIGHT_G = 100;

function densityFor(name: string): number {
  return (
    DENSITY_G_PER_ML.get(normalizeFoodName(name)) ?? DEFAULT_DENSITY_G_PER_ML
  );
}

function pieceWeightFor(name: string): number {
  return PIECE_WEIGHT_G.get(normalizeFoodName(name)) ?? DEFAULT_PIECE_WEIGHT_G;
}

/**
 * Convert `gramsConsumed` into the amount to subtract from a pantry item whose
 * stock is measured in `unit`. Returns `null` when the unit is unknown or has
 * no fixed gram equivalence (caller should leave the item as-is).
 */
export function gramsToUnitQty(
  gramsConsumed: number,
  unit: string | null | undefined,
  name: string,
): number | null {
  if (!Number.isFinite(gramsConsumed) || gramsConsumed <= 0) return null;
  const u = normalizeUnit(unit) ?? "г";
  switch (u) {
    case "г":
      return gramsConsumed;
    case "кг":
      return gramsConsumed / 1000;
    case "мл":
      return gramsConsumed / densityFor(name);
    case "л":
      return gramsConsumed / densityFor(name) / 1000;
    case "шт":
      return gramsConsumed / pieceWeightFor(name);
    default:
      // `уп`/`пач` and any other non-mass-equivalent unit: no conversion.
      return null;
  }
}
