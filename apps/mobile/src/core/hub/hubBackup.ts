/**
 * Mobile hub backup — build / apply a cross-platform JSON payload.
 *
 * Mirrors `apps/web/src/core/hub/hubBackup.ts` but reads/writes MMKV
 * via `@/lib/storage` instead of `localStorage`. The on-disk format is
 * identical so a file exported from mobile can be imported on web and
 * vice versa.
 */

import { STORAGE_KEYS } from "@sergeant/shared";
import { FIZRUK_FULL_BACKUP_KEYS } from "@sergeant/fizruk-domain";
import {
  FINYK_FIELD_TO_STORAGE_KEY,
  normalizeFinykBackup,
  type FinykBackup,
} from "@sergeant/finyk-domain/backup";
import {
  normalizeRoutineState,
  ensureHabitOrder,
} from "@sergeant/routine-domain";

import { safeReadLS, safeWriteLS, safeReadStringLS } from "@/lib/storage";

export const HUB_BACKUP_KIND = "hub-backup";
export const HUB_BACKUP_SCHEMA_VERSION = 1;

interface HubBackupPayload {
  kind: typeof HUB_BACKUP_KIND;
  schemaVersion: number;
  exportedAt: string;
  finyk: unknown;
  fizruk: unknown;
  routine: unknown;
  nutrition: unknown;
  hub?: { lastModule?: string };
}

function readFinykFromMMKV(): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [field, storageKey] of Object.entries(
    FINYK_FIELD_TO_STORAGE_KEY,
  )) {
    const raw = safeReadLS<unknown>(storageKey, undefined);
    if (raw !== undefined) result[field] = raw;
  }
  return result;
}

export function buildHubBackupPayload(): HubBackupPayload {
  // Routine
  const routineRaw = safeReadLS<unknown>(STORAGE_KEYS.ROUTINE, null);
  const routine = routineRaw
    ? {
        kind: "hub-routine-backup" as const,
        schemaVersion: 3,
        exportedAt: new Date().toISOString(),
        data: routineRaw,
      }
    : {};

  // Fizruk
  const fizrukData: Record<string, string | null> = {};
  for (const k of FIZRUK_FULL_BACKUP_KEYS) {
    fizrukData[k] = safeReadStringLS(k, null);
  }
  const fizruk = {
    kind: "fizruk-full-backup" as const,
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    data: fizrukData,
  };

  // Nutrition
  const nutrition = {
    kind: "hub-nutrition-backup" as const,
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    data: {
      stateSchemaVersion: 1,
      pantries: safeReadLS<unknown>(STORAGE_KEYS.NUTRITION_PANTRIES, []),
      activePantryId:
        safeReadStringLS(STORAGE_KEYS.NUTRITION_ACTIVE_PANTRY, null) || "home",
      prefs: safeReadLS<unknown>(STORAGE_KEYS.NUTRITION_PREFS, {}),
      log: safeReadLS<unknown>(STORAGE_KEYS.NUTRITION_LOG, {}),
    },
  };

  // Finyk
  const finykRaw = readFinykFromMMKV();
  let finyk: unknown;
  try {
    finyk = normalizeFinykBackup({ ...finykRaw, version: 2 });
  } catch {
    finyk = finykRaw;
  }

  // Hub meta
  const hub: Record<string, string> = {};
  const lastModule = safeReadStringLS(STORAGE_KEYS.LAST_MODULE, null);
  if (lastModule) hub.lastModule = lastModule;

  return {
    kind: HUB_BACKUP_KIND,
    schemaVersion: HUB_BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    finyk,
    fizruk,
    routine,
    nutrition,
    hub: Object.keys(hub).length ? hub : undefined,
  };
}

export function isHubBackupPayload(
  parsed: unknown,
): parsed is HubBackupPayload {
  return (
    parsed != null &&
    typeof parsed === "object" &&
    !Array.isArray(parsed) &&
    (parsed as Record<string, unknown>).kind === HUB_BACKUP_KIND &&
    typeof (parsed as Record<string, unknown>).schemaVersion === "number"
  );
}

export function applyHubBackupPayload(parsed: unknown): void {
  if (!isHubBackupPayload(parsed)) {
    throw new Error("Некоректний файл резервної копії Hub.");
  }

  // Finyk
  if (parsed.finyk && typeof parsed.finyk === "object") {
    try {
      const normalized = normalizeFinykBackup(parsed.finyk) as FinykBackup;
      for (const [field, storageKey] of Object.entries(
        FINYK_FIELD_TO_STORAGE_KEY,
      )) {
        const value = (normalized as Record<string, unknown>)[field];
        if (value !== undefined) safeWriteLS(storageKey, value);
      }
    } catch {
      // Best-effort: write any raw finyk keys present
    }
  }

  // Routine
  if (
    parsed.routine &&
    typeof parsed.routine === "object" &&
    (parsed.routine as Record<string, unknown>).data
  ) {
    const d = (parsed.routine as Record<string, unknown>).data;
    const merged = normalizeRoutineState(d);
    const { state } = ensureHabitOrder(merged);
    safeWriteLS(STORAGE_KEYS.ROUTINE, state);
  }

  // Fizruk
  if (parsed.fizruk && typeof parsed.fizruk === "object") {
    const d = (parsed.fizruk as Record<string, unknown>).data;
    if (d && typeof d === "object") {
      for (const k of FIZRUK_FULL_BACKUP_KEYS) {
        const v = (d as Record<string, unknown>)[k];
        if (v !== undefined) safeWriteLS(k, v);
      }
    }
  }

  // Nutrition
  if (parsed.nutrition && typeof parsed.nutrition === "object") {
    const d = (parsed.nutrition as Record<string, unknown>).data;
    if (d && typeof d === "object") {
      const data = d as Record<string, unknown>;
      if (data.pantries !== undefined)
        safeWriteLS(STORAGE_KEYS.NUTRITION_PANTRIES, data.pantries);
      if (data.activePantryId !== undefined)
        safeWriteLS(STORAGE_KEYS.NUTRITION_ACTIVE_PANTRY, data.activePantryId);
      if (data.prefs !== undefined)
        safeWriteLS(STORAGE_KEYS.NUTRITION_PREFS, data.prefs);
      if (data.log !== undefined)
        safeWriteLS(STORAGE_KEYS.NUTRITION_LOG, data.log);
    }
  }

  // Hub meta
  if (parsed.hub && typeof parsed.hub === "object") {
    const h = parsed.hub;
    if (h.lastModule) {
      safeWriteLS(STORAGE_KEYS.LAST_MODULE, h.lastModule);
    }
  }
}
