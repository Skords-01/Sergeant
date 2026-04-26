/**
 * Fizruk module — public entry point.
 *
 * Prefer importing from `@fizruk` instead of deep paths for cross-module
 * consumers (e.g. App router, hub registry):
 *
 *   import { FizrukApp } from "@fizruk";
 *
 * Deep imports remain recommended for intra-module use.
 */

export { default as FizrukApp } from "./FizrukApp";
