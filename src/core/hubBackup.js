import {
  normalizeFinykBackup,
  readFinykBackupFromStorage,
  persistFinykNormalizedToStorage,
} from "../modules/finyk/lib/finykBackup.js";
import {
  buildFizrukFullBackupPayload,
  applyFizrukFullBackupPayload,
} from "../modules/fizruk/lib/fizrukStorage.js";
import {
  buildRoutineBackupPayload,
  applyRoutineBackupPayload,
} from "../modules/routine/lib/routineStorage.js";
import {
  applyNutritionBackupPayload,
  buildNutritionBackupPayload,
} from "../modules/nutrition/domain/nutritionBackup.js";

const HUB_MODULE_KEY = "hub_last_module";
const HUB_CHAT_KEY = "hub_chat_history";
const VALID_MODULES = new Set(["finyk", "fizruk", "routine", "nutrition"]);

export const HUB_BACKUP_KIND = "hub-backup";
export const HUB_BACKUP_SCHEMA_VERSION = 1;

/**
 * @param {{ includeChat?: boolean }} [options]
 */
export function buildHubBackupPayload(options = {}) {
  const { includeChat = false } = options;
  let finyk;
  try {
    finyk = normalizeFinykBackup(readFinykBackupFromStorage());
  } catch {
    finyk = {};
  }
  const hub = {};
  if (typeof localStorage !== "undefined") {
    const m = localStorage.getItem(HUB_MODULE_KEY);
    if (m) hub.lastModule = m;
    if (includeChat) {
      const chat = localStorage.getItem(HUB_CHAT_KEY);
      if (chat) hub.chatHistory = chat;
    }
  }
  return {
    kind: HUB_BACKUP_KIND,
    schemaVersion: HUB_BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    finyk,
    fizruk: buildFizrukFullBackupPayload(),
    routine: buildRoutineBackupPayload(),
    nutrition: buildNutritionBackupPayload(),
    hub: Object.keys(hub).length ? hub : undefined,
  };
}

/**
 * @param {unknown} parsed
 */
export function isHubBackupPayload(parsed) {
  return (
    parsed != null &&
    typeof parsed === "object" &&
    !Array.isArray(parsed) &&
    parsed.kind === HUB_BACKUP_KIND &&
    typeof parsed.schemaVersion === "number"
  );
}

/**
 * @param {unknown} parsed
 */
export function applyHubBackupPayload(parsed) {
  if (!isHubBackupPayload(parsed)) {
    throw new Error("Некоректний файл резервної копії Hub.");
  }
  if (parsed.finyk && typeof parsed.finyk === "object") {
    const keys = Object.keys(parsed.finyk).filter((k) => k !== "version");
    if (keys.length > 0) {
      const withVer =
        "version" in parsed.finyk
          ? parsed.finyk
          : { ...parsed.finyk, version: 1 };
      persistFinykNormalizedToStorage(normalizeFinykBackup(withVer));
    }
  }
  if (parsed.routine) {
    applyRoutineBackupPayload(parsed.routine);
  }
  if (parsed.fizruk) {
    applyFizrukFullBackupPayload(parsed.fizruk);
  }
  if (parsed.nutrition) {
    applyNutritionBackupPayload(parsed.nutrition);
  }
  if (parsed.hub && typeof parsed.hub === "object") {
    const h = parsed.hub;
    if (h.lastModule && VALID_MODULES.has(h.lastModule)) {
      localStorage.setItem(HUB_MODULE_KEY, h.lastModule);
    }
    if (typeof h.chatHistory === "string") {
      localStorage.setItem(HUB_CHAT_KEY, h.chatHistory);
    }
  }
}
