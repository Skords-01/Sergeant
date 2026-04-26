/**
 * Routine module — public entry point.
 *
 * Prefer importing from `@routine` instead of deep paths for cross-module
 * consumers (e.g. App router, hub registry):
 *
 *   import { RoutineApp, type RoutineAppProps } from "@routine";
 *
 * Deep imports remain recommended for intra-module use.
 */

export { default as RoutineApp } from "./RoutineApp";
export type { RoutineAppProps } from "./RoutineApp";
