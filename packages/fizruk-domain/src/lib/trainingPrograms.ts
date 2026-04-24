/**
 * Back-compat shim for the legacy `lib/trainingPrograms` surface.
 *
 * The canonical source for the training-program catalogue + resolvers
 * lives in {@link import("../domain/programs/index.js")}. This file
 * preserves the two loose-typed helpers that `apps/web` has depended
 * on since the pre-Phase-6 era:
 *
 *  - `getTodaySession(program)` — returns the **schedule entry**
 *    (`{ day, sessionKey, name }`) for today or `null` on a rest
 *    day. New mobile / web code should prefer
 *    {@link import("../domain/programs/today.js").resolveTodaySession}
 *    which returns the fully-resolved `{ programId, schedule, session }`
 *    triple.
 *  - `getDefaultRestSec(primaryGroup)` — unrelated rest-default
 *    helper that historically lived in this file; kept here to avoid
 *    churn in callers.
 *
 * `BUILTIN_PROGRAMS` and `getProgramScheduleForDay` are re-exported
 * directly from `domain/programs` via the top-level package barrel —
 * consumers should import them from `@sergeant/fizruk-domain` without
 * reaching for `/lib/`.
 */

import {
  getProgramScheduleForDay,
  weekdayIndex,
  type ProgramScheduleEntry,
  type TrainingProgramDef,
} from "../domain/programs/index.js";

/**
 * Schedule entry for today (based on the current system clock) or
 * `null` on a rest day. Maintains the legacy signature — callers that
 * need the fully-resolved `{ programId, schedule, session }` triple
 * should use `resolveTodaySession` from `domain/programs`.
 */
export function getTodaySession(
  program: TrainingProgramDef | null | undefined,
): ProgramScheduleEntry | null {
  return getProgramScheduleForDay(program, weekdayIndex());
}

/**
 * Heuristic default rest duration, in seconds, for a given
 * `primaryGroup` tag from the exercise catalogue. Kept here for
 * backwards compatibility — the restrictions screen owns the
 * user-editable version under `fizruk_rest_settings_v1`.
 */
export function getDefaultRestSec(
  primaryGroup: string | null | undefined,
): number {
  if (!primaryGroup) return 90;
  const compound = [
    "chest",
    "back",
    "quadriceps",
    "hamstrings",
    "glutes",
    "full_body",
  ];
  const isolation = [
    "shoulders",
    "biceps",
    "triceps",
    "forearms",
    "core",
    "calves",
  ];
  if (compound.includes(primaryGroup)) return 90;
  if (isolation.includes(primaryGroup)) return 60;
  return 30;
}
