/**
 * Shared domain types for the Fizruk module.
 *
 * Intentionally loose (optional fields, open unions) so gradual TS adoption
 * does not break existing JS callers or persisted localStorage payloads.
 */

/** Recovery status for a muscle group. */
export type RecoveryStatus = "green" | "yellow" | "red";

/** Recovery state for a single muscle group. */
export interface MuscleState {
  id: string;
  label: string;
  lastAt: number | null;
  daysSince: number | null;
  load7d: number;
  fatigue: number;
  status: RecoveryStatus;
}

/** Checklist item (warm-up / cool-down step). */
export interface ChecklistItem {
  id: string;
  done: boolean;
  label: string;
}

/** A single exercise set (weight × reps). */
export interface WorkoutSet {
  weightKg: number;
  reps: number;
}

/** Kind of exercise entry. */
export type WorkoutItemType = "strength" | "distance" | "time";

/** A single exercise entry within a workout session. */
export interface WorkoutItem {
  id: string;
  exerciseId: string;
  nameUk: string;
  primaryGroup: string;
  musclesPrimary: string[];
  musclesSecondary: string[];
  type: WorkoutItemType;
  sets?: WorkoutSet[];
  durationSec?: number;
  distanceM?: number;
  [key: string]: unknown;
}

/** Superset group inside a workout. */
export interface WorkoutGroup {
  id: string;
  itemIds: string[];
}

/** A complete workout session. */
export interface Workout {
  id: string;
  startedAt: string;
  endedAt: string | null;
  items: WorkoutItem[];
  groups: WorkoutGroup[];
  warmup: ChecklistItem[] | null;
  cooldown: ChecklistItem[] | null;
  note: string;
  [key: string]: unknown;
}

/** Persisted daily log entry (sleep, energy, weight, mood…). */
export interface DailyLogEntry {
  id: string;
  at: string;
  weightKg?: number | null;
  sleepHours?: number | null;
  energyLevel?: number | null;
  mood?: number | null;
  note?: string;
  [key: string]: unknown;
}

/** Body progress photo record. */
export interface BodyPhoto {
  id: string;
  date: string;
  dataUrl: string;
  note: string;
  createdAt: number | string;
}

/** Measurement entry (chest/waist/etc. in cm, weight in kg…). */
export interface MeasurementEntry {
  id: string;
  at: string;
  [fieldId: string]: string | number | undefined;
}

/** User-saved workout template. */
export interface WorkoutTemplate {
  id: string;
  name: string;
  exerciseIds: string[];
  groups: WorkoutGroup[];
  updatedAt: string;
  lastUsedAt?: string;
}

/** Built-in training program session day. */
export interface ProgramSession {
  id: string;
  name: string;
  exerciseIds: string[];
  progressionKg?: Record<string, number>;
  [key: string]: unknown;
}

/** Built-in training program. */
export interface TrainingProgram {
  id: string;
  name: string;
  description?: string;
  sessions: ProgramSession[];
  weekPattern?: (string | null)[];
  [key: string]: unknown;
}

/** Exercise definition from the exercise catalog. */
export interface ExerciseDef {
  id: string;
  nameUk: string;
  primaryGroup: string;
  musclesPrimary: string[];
  musclesSecondary: string[];
  type: WorkoutItemType;
  [key: string]: unknown;
}
