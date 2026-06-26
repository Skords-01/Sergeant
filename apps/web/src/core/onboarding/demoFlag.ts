/**
 * Leaf module for the demo-mode flag read.
 *
 * Deliberately depends on nothing but the constants-only key module and
 * the storage primitive — NO `@sergeant/shared`, no onboarding helpers.
 * Low-level module-storage code (Фізрук/Routine read paths) imports the
 * flag from here so it never pulls the heavier `onboardingGate` barrel
 * into its graph, which would risk an import cycle.
 *
 * `onboardingGate.isDemoActive` re-exports this so there is a single
 * source of truth.
 */

import { safeReadStringLS } from "@shared/lib/storage/storage";
import { DEMO_FLAG_KEY } from "./seedDemoData/keys";

/** True when the local store currently holds a seeded demo payload. */
export function isDemoActive(): boolean {
  return safeReadStringLS(DEMO_FLAG_KEY) === "1";
}
