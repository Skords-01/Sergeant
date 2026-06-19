/* eslint-disable sergeant-design/prefer-kyiv-time */
import {
  readJSON as finykReadJSON,
  writeJSON as finykWriteJSON,
  writeRaw as finykWriteRaw,
} from "@finyk/lib/finykStorage";
import { fizrukStorage } from "@fizruk/lib/fizrukStorageInstance";
import { nutritionStorage } from "@nutrition/lib/nutritionStorageInstance";
import { createHabit, loadRoutineState } from "@routine/lib/routineStorage";

// Writes a single preset entry directly into the matching module's
// localStorage key. This is how the FTUX PresetSheet turns "tap a tile"
// into a real (non-demo) entry without forcing the user into a module's
// full input wizard first.
//
// The writers here intentionally skip the modules' public
// `save*`/`createHabit` APIs and poke localStorage directly for one
// reason: those APIs are debounced (see `createModuleStorage`) and the
// FTUX celebration needs the entry to be visible on the very next
// render of the Hub dashboard. A 200 ms debounce window is invisible in
// normal use but long enough to break the 30-second promise headline.
//
// Each writer:
//   - fans out the same storage-change event the module listens to, so
//     the Hub dashboard re-renders synchronously;
//   - writes an entry with `demo: false` (explicit) so
//     `detectFirstRealEntry` picks it up immediately;
//   - is idempotent w.r.t. the preset itself — two rapid taps of the
//     same preset create two entries, which mirrors normal module
//     behavior (users can log the same habit / expense / meal twice).

const FINYK_MANUAL_EXPENSES_KEY = "finyk_manual_expenses_v1";
const FINYK_MANUAL_ONLY_KEY = "finyk_manual_only_v1";
const FIZRUK_WORKOUTS_KEY = "fizruk_workouts_v1";
const NUTRITION_LOG_KEY = "nutrition_log_v1";
const NUTRITION_LOG_EVENT = "nutrition-log-storage";

export type FinykPreset = {
  description: string;
  amount: number;
  category: string;
};

export type RoutinePreset = {
  name: string;
  emoji?: string;
};

export type FizrukPreset = {
  name: string;
  durationMin: number;
};

export type NutritionPreset = {
  name: string;
  kcal: number;
  mealType?: string;
};

type FizrukWorkout = {
  id: string;
  demo: boolean;
  name: string;
  startedAt: string;
  finishedAt: string;
  durationSec: number;
  exercises: unknown[];
};

type FizrukWorkoutsState = {
  schemaVersion?: number;
  workouts?: FizrukWorkout[];
};

type NutritionMeal = {
  id: string;
  demo: boolean;
  name: string;
  time: string;
  mealType: string;
  label: string;
  macros: {
    kcal: number;
    protein_g: number;
    fat_g: number;
    carbs_g: number;
  };
  source: string;
  macroSource: string;
  amount_g: number | null;
  foodId: string | null;
};

type NutritionDay = {
  meals?: NutritionMeal[];
};

type NutritionLogState = Record<string, NutritionDay>;

function dispatch(eventName: string) {
  try {
    window.dispatchEvent(new CustomEvent(eventName));
  } catch {
    /* noop */
  }
}

function uid(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function toLocalISODate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ─── Finyk ───────────────────────────────────────────────────────────────

// AI-CONTEXT: bypasses `createModuleStorage()` and writes the raw LS key
// directly. The FTUX preset needs a synchronous flush so the user sees the
// seeded entry on the very first Finyk render — `createModuleStorage` adds a
// debounce that would race the navigation. Rename `FINYK_MANUAL_EXPENSES_KEY`
// here AND in `apps/web/src/core/modules/finyk/storage.ts` together; a drift
// silently breaks preset seeding.
function applyFinykPreset(preset: FinykPreset) {
  const existing = finykReadJSON<unknown>(FINYK_MANUAL_EXPENSES_KEY, []);
  const list = Array.isArray(existing) ? existing : [];
  const entry = {
    id: uid("tx"),
    demo: false,
    date: new Date().toISOString(),
    description: preset.description,
    amount: preset.amount,
    category: preset.category,
  };
  // Finyk cross-device sync живе у SQLite + op-log v2 (Stage 4 PR #039);
  // цей LS write — local-only onboarding seed на tombstone-ключі
  // (`@deprecated` у storageKeys.ts), residual-import drains у SQLite
  // на наступний boot.
  finykWriteJSON(FINYK_MANUAL_EXPENSES_KEY, [entry, ...list]);
  // Keep the user out of the Monobank login gate — mirrors what
  // `enableFinykManualOnly()` does on the «Далі без банку» path.
  // `writeRaw` keeps raw strings as-is (no JSON.stringify) so the stored
  // value matches the legacy `localStorage.setItem(_, "1")` shape.
  finykWriteRaw(FINYK_MANUAL_ONLY_KEY, "1");
}

// ─── Routine ─────────────────────────────────────────────────────────────

function applyRoutinePreset(preset: RoutinePreset) {
  // FTUX preset creates a real (non-demo) habit. Stage 8 PR #057r-tombstone
  // retired the `hub_routine_v1` LS write — `loadRoutineState`/`saveRoutineState`
  // are SQLite-backed now, so poking the LS key directly produced a habit the
  // module never reads. Route through the canonical `createHabit` persist: its
  // `applyCreateHabit` defaults (daily recurrence, every weekday, today's start,
  // `✓` emoji fallback) match the old preset shape, and `saveRoutineState`'s
  // synchronous cache write-through keeps the habit visible on the next Hub
  // render — the debounced-LS-write reason for bypassing this API is gone.
  createHabit(loadRoutineState(), {
    name: preset.name,
    emoji: preset.emoji || "✓",
  });
}

// ─── Fizruk ──────────────────────────────────────────────────────────────

function applyFizrukPreset(preset: FizrukPreset) {
  const existing = fizrukStorage.readJSON<
    FizrukWorkoutsState | FizrukWorkout[]
  >(FIZRUK_WORKOUTS_KEY, null);
  const existingList: FizrukWorkout[] = Array.isArray(existing)
    ? existing
    : existing && Array.isArray(existing.workouts)
      ? existing.workouts
      : [];
  const now = new Date();
  const startedAt = new Date(now.getTime() - preset.durationMin * 60000);
  const workout: FizrukWorkout = {
    id: uid("wo"),
    demo: false,
    name: preset.name,
    startedAt: startedAt.toISOString(),
    finishedAt: now.toISOString(),
    durationSec: preset.durationMin * 60,
    exercises: [],
  };
  fizrukStorage.writeJSON(FIZRUK_WORKOUTS_KEY, {
    schemaVersion: 1,
    workouts: [workout, ...existingList],
  });
}

// ─── Nutrition ───────────────────────────────────────────────────────────

function applyNutritionPreset(preset: NutritionPreset) {
  const existing = nutritionStorage.readJSON<NutritionLogState>(
    NUTRITION_LOG_KEY,
    null,
  );
  const base: NutritionLogState =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...existing }
      : {};
  const today = toLocalISODate();
  const day: NutritionDay =
    base[today] && typeof base[today] === "object"
      ? { ...base[today] }
      : { meals: [] };
  const meals: NutritionMeal[] = Array.isArray(day.meals) ? [...day.meals] : [];
  const kcal = preset.kcal;
  meals.push({
    id: uid("meal"),
    demo: false,
    name: preset.name,
    time: new Date().toTimeString().slice(0, 5),
    mealType: preset.mealType || "snack",
    label: preset.name,
    macros: {
      kcal,
      protein_g: Math.round((kcal * 0.22) / 4),
      fat_g: Math.round((kcal * 0.28) / 9),
      carbs_g: Math.round((kcal * 0.5) / 4),
    },
    source: "manual",
    macroSource: "manual",
    amount_g: null,
    foodId: null,
  });
  day.meals = meals;
  base[today] = day;
  // Nutrition cross-device sync живе у SQLite + op-log v2 (Stage 4 PR #034);
  // цей LS write — local-only onboarding seed на tombstone-ключі
  // (`@deprecated` у storageKeys.ts), residual-import drains у SQLite
  // на наступний boot.
  nutritionStorage.writeJSON(NUTRITION_LOG_KEY, base);
  dispatch(NUTRITION_LOG_EVENT);
}

export type ModuleId = "routine" | "finyk" | "nutrition" | "fizruk";

export type ModulePreset =
  | RoutinePreset
  | FinykPreset
  | NutritionPreset
  | FizrukPreset;

/**
 * Apply a preset to the matching module storage. The module id decides
 * which writer runs — the caller passes only preset fields relevant to
 * its module.
 */
export function applyPreset(moduleId: ModuleId, preset: ModulePreset) {
  switch (moduleId) {
    case "routine":
      applyRoutinePreset(preset as RoutinePreset);
      return;
    case "finyk":
      applyFinykPreset(preset as FinykPreset);
      return;
    case "nutrition":
      applyNutritionPreset(preset as NutritionPreset);
      return;
    case "fizruk":
      applyFizrukPreset(preset as FizrukPreset);
      return;
    default:
      /* noop */
      return;
  }
}
