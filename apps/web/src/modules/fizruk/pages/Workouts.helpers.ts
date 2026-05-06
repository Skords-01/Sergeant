import type {
  WorkoutFinishSummary,
  WorkoutItem,
} from "@sergeant/fizruk-domain";
import type { RawExerciseDef } from "@sergeant/fizruk-domain/data";

// Static `view` enum + the legacy `mode` projection that subcomponents
// (ExerciseDetailSheet, WorkoutCatalogSection) still branch on. Keeping
// both names here means the composition root just forwards strings.
export type WorkoutsView = "home" | "catalog" | "log" | "templates";
export type WorkoutsMode = "catalog" | "log";

export function deriveWorkoutsMode(view: WorkoutsView): WorkoutsMode {
  return view === "templates" || view === "home" ? "catalog" : view;
}

/**
 * Mirrors `FinishFlashState` in `WorkoutJournalSection` / consumed by
 * `WorkoutFinishSheets`. Owned here so the `useState` setter can be
 * passed across both sheets without re-deriving the shape twice.
 */
export interface FinishFlashState extends WorkoutFinishSummary {
  step: "wellbeing" | "summary";
  collapsed: boolean;
  workoutId: string;
  energy: number | null;
  mood: number | null;
  savedWellbeing?: { energy?: number | null; mood?: number | null } | null;
}

/**
 * The catalog `WorkoutItem` carries the workout `startedAt` when
 * resolved as the most recent occurrence of an exercise. We only attach
 * a single extra field, so widen the canonical domain item rather than
 * lying via `any`.
 */
export type LastExerciseItem = WorkoutItem & { _startedAt?: string };

/**
 * Templates persist `groups` as `unknown[]` (see useWorkoutTemplates),
 * so narrow each group to the template-shape we read here before
 * building the workout-side `groups` payload.
 */
export interface TemplateGroup {
  id: string;
  exerciseIds?: string[];
  itemIds?: string[];
  type?: "circuit" | "superset";
  restSec?: number;
}

/**
 * Catalog primary-group ordering used by the catalog list. Front-loads
 * upper body → core → lower body → full body → cardio. Same order as
 * before decomposition — extracted here so the page-state hook stays
 * presentation-light.
 */
export const PRIMARY_GROUP_ORDER = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "forearms",
  "core",
  "quadriceps",
  "hamstrings",
  "calves",
  "glutes",
  "full_body",
  "cardio",
] as const;

/**
 * Build the `addItem` payload for a catalog exercise. Cardio entries
 * default to a distance-mode item; everything else gets a single
 * `0×0` strength set the user can edit immediately. Centralised so
 * QuickStart, retro, and template launches all push identical shapes.
 */
export function buildWorkoutItemFromExercise(ex: RawExerciseDef) {
  const isCardio = ex.primaryGroup === "cardio";
  return {
    exerciseId: ex.id,
    nameUk: ex?.name?.uk || ex?.name?.en,
    primaryGroup: ex.primaryGroup,
    musclesPrimary: ex?.muscles?.primary || [],
    musclesSecondary: ex?.muscles?.secondary || [],
    type: (isCardio ? "distance" : "strength") as "distance" | "strength",
    sets: isCardio ? undefined : [{ weightKg: 0, reps: 0 }],
    durationSec: isCardio ? 0 : 0,
    distanceM: isCardio ? 0 : 0,
  };
}

/** Today's local date as `"YYYY-MM-DD"` (used as the default retro date). */
export function todayLocalISODate(): string {
  const x = new Date();
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}
