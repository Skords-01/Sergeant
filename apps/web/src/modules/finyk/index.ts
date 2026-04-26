/**
 * Finyk module — public entry point.
 *
 * Prefer importing from `@finyk` or `@modules/finyk` instead of deep paths
 * for cross-module consumers (e.g. App router, hub registry):
 *
 *   import { FinykApp } from "@finyk";
 *
 * Deep imports (`@finyk/utils`, `@finyk/constants`) are still recommended
 * for intra-module use and tree-shaking-sensitive call sites.
 */

export { default as FinykApp } from "./FinykApp";
