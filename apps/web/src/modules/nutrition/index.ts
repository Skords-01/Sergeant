/**
 * Nutrition module — public entry point.
 *
 * Prefer importing from `@nutrition` instead of deep paths for cross-module
 * consumers (e.g. App router, hub registry):
 *
 *   import { NutritionApp } from "@nutrition";
 *
 * Deep imports remain recommended for intra-module use.
 */

export { default as NutritionApp } from "./NutritionApp";
