/**
 * Lightweight demo read-path helpers.
 *
 * Demo mode is anonymous, so the SQLite read-boot (`useFizrukSqliteReadBoot`)
 * never runs and the read cache stays cold. The Stage-8 tombstone removed
 * the LS fallback from the consumer hooks, which leaves Фізрук looking empty
 * in demo even though the seeder wrote the sample data to localStorage.
 *
 * These readers surface the seeded `fizruk_workouts_v1` /
 * `fizruk_measurements_v1` blobs directly. They deliberately depend only on
 * the domain parsers + the light module-storage instance — NOT on
 * `residualImport`, which pulls the heavy dual-write / SQLite-migration graph
 * into the read hooks' chunk.
 */

import {
  MEASUREMENTS_STORAGE_KEY,
  WORKOUTS_STORAGE_KEY,
  parseWorkoutsFromStorage,
  type MeasurementEntry,
  type Workout,
} from "@sergeant/fizruk-domain";
import { fizrukStorage } from "./fizrukStorageInstance.js";

/** Seeded demo workouts from LS, or `null` when the key is absent/unreadable. */
export function readDemoWorkoutsFromLs(): Workout[] | null {
  try {
    const raw = fizrukStorage.readRaw(WORKOUTS_STORAGE_KEY, null);
    if (raw == null) return null;
    const parsed = parseWorkoutsFromStorage(raw);
    return Array.isArray(parsed) ? (parsed as Workout[]) : [];
  } catch {
    return null;
  }
}

/** Seeded demo measurements from LS, or `null` when absent/unreadable. */
export function readDemoMeasurementsFromLs(): MeasurementEntry[] | null {
  try {
    const raw = fizrukStorage.readJSON<unknown>(MEASUREMENTS_STORAGE_KEY, null);
    if (raw == null) return null;
    return Array.isArray(raw) ? (raw as MeasurementEntry[]) : [];
  } catch {
    return null;
  }
}
