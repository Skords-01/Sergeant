import { DEFAULT_SUBSCRIPTIONS } from "../constants.js";
import { notifyFinykRoutineCalendarSync } from "../hubRoutineSync.js";
import { readJSON, writeJSON } from "./finykStorage.js";

/** Версія формату експорту JSON (бекап). */
export const FINYK_BACKUP_VERSION = 3;

const DEFAULT_MONTHLY_PLAN = { income: "", expense: "", savings: "" };

function readJsonFromLocalStorage(key, fallback) {
  return readJSON(key, fallback);
}

/**
 * Знімок даних Фініка з localStorage (без React), той самий зміст що й exportData.
 */
export function readFinykBackupFromStorage() {
  return {
    version: FINYK_BACKUP_VERSION,
    budgets: readJsonFromLocalStorage("finyk_budgets", []),
    subscriptions: readJsonFromLocalStorage(
      "finyk_subs",
      DEFAULT_SUBSCRIPTIONS,
    ),
    manualAssets: readJsonFromLocalStorage("finyk_assets", []),
    manualDebts: readJsonFromLocalStorage("finyk_debts", []),
    receivables: readJsonFromLocalStorage("finyk_recv", []),
    hiddenAccounts: readJsonFromLocalStorage("finyk_hidden", []),
    hiddenTxIds: readJsonFromLocalStorage("finyk_hidden_txs", []),
    monthlyPlan: readJsonFromLocalStorage(
      "finyk_monthly_plan",
      DEFAULT_MONTHLY_PLAN,
    ),
    txCategories: readJsonFromLocalStorage("finyk_tx_cats", {}),
    txSplits: readJsonFromLocalStorage("finyk_tx_splits", {}),
    monoDebtLinkedTxIds: readJsonFromLocalStorage("finyk_mono_debt_linked", {}),
    networthHistory: readJsonFromLocalStorage("finyk_networth_history", []),
    customCategories: readJsonFromLocalStorage("finyk_custom_cats_v1", []),
    dismissedRecurring: readJsonFromLocalStorage("finyk_rec_dismissed", []),
  };
}

const FINYK_FIELD_TO_STORAGE_KEY = {
  budgets: "finyk_budgets",
  subscriptions: "finyk_subs",
  manualAssets: "finyk_assets",
  manualDebts: "finyk_debts",
  receivables: "finyk_recv",
  hiddenAccounts: "finyk_hidden",
  hiddenTxIds: "finyk_hidden_txs",
  monthlyPlan: "finyk_monthly_plan",
  txCategories: "finyk_tx_cats",
  txSplits: "finyk_tx_splits",
  monoDebtLinkedTxIds: "finyk_mono_debt_linked",
  networthHistory: "finyk_networth_history",
  customCategories: "finyk_custom_cats_v1",
  dismissedRecurring: "finyk_rec_dismissed",
};

/**
 * Записує нормалізований бекап Фініка в localStorage (після normalizeFinykBackup).
 */
export function persistFinykNormalizedToStorage(normalized) {
  for (const [field, storageKey] of Object.entries(
    FINYK_FIELD_TO_STORAGE_KEY,
  )) {
    if (normalized[field] !== undefined) {
      writeJSON(storageKey, normalized[field]);
    }
  }
  notifyFinykRoutineCalendarSync();
}

/**
 * Перевіряє та нормалізує об'єкт бекапу для застосування в сховище.
 * Підтримує version 1 (без категорій/сплітів) і 2 (повний набір).
 * @param {unknown} parsed — результат JSON.parse
 * @returns {object} поля для applyData
 */
export function normalizeFinykBackup(parsed) {
  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Файл має містити JSON-об'єкт");
  }
  if (Object.keys(parsed).length === 0) {
    throw new Error("Порожній об'єкт у файлі");
  }

  const version = typeof parsed.version === "number" ? parsed.version : 1;
  if (version < 1 || version > 999) {
    throw new Error("Невідома версія бекапу");
  }

  const out = {};

  const needArr = (v, name) => {
    if (v === undefined || v === null) return;
    if (!Array.isArray(v)) throw new Error(`Поле «${name}» має бути масивом`);
    return v;
  };
  const needObj = (v, name) => {
    if (v === undefined || v === null) return;
    if (typeof v !== "object" || Array.isArray(v))
      throw new Error(`Поле «${name}» має бути об'єктом`);
    return v;
  };

  const b = needArr(parsed.budgets, "budgets");
  if (b) out.budgets = b;
  const s = needArr(parsed.subscriptions, "subscriptions");
  if (s) out.subscriptions = s;
  const ma = needArr(parsed.manualAssets, "manualAssets");
  if (ma) out.manualAssets = ma;
  const md = needArr(parsed.manualDebts, "manualDebts");
  if (md) out.manualDebts = md;
  const r = needArr(parsed.receivables, "receivables");
  if (r) out.receivables = r;
  const ha = needArr(parsed.hiddenAccounts, "hiddenAccounts");
  if (ha) out.hiddenAccounts = ha;
  const ht = needArr(parsed.hiddenTxIds, "hiddenTxIds");
  if (ht) out.hiddenTxIds = ht;

  if (parsed.monthlyPlan !== undefined && parsed.monthlyPlan !== null) {
    if (
      typeof parsed.monthlyPlan !== "object" ||
      Array.isArray(parsed.monthlyPlan)
    ) {
      throw new Error("Поле «monthlyPlan» має бути об'єктом");
    }
    out.monthlyPlan = parsed.monthlyPlan;
  }

  const tc = needObj(parsed.txCategories, "txCategories");
  if (tc) out.txCategories = tc;
  const ts = needObj(parsed.txSplits, "txSplits");
  if (ts) out.txSplits = ts;
  const mdl = needObj(parsed.monoDebtLinkedTxIds, "monoDebtLinkedTxIds");
  if (mdl) out.monoDebtLinkedTxIds = mdl;

  if (parsed.networthHistory !== undefined && parsed.networthHistory !== null) {
    const nh = needArr(parsed.networthHistory, "networthHistory");
    if (nh) {
      for (const row of nh) {
        if (!row || typeof row !== "object" || typeof row.month !== "string") {
          throw new Error("Некоректний запис у networthHistory");
        }
      }
      out.networthHistory = nh;
    }
  }

  const cc = needArr(parsed.customCategories, "customCategories");
  if (cc) {
    for (const row of cc) {
      if (
        !row ||
        typeof row !== "object" ||
        typeof row.id !== "string" ||
        typeof row.label !== "string"
      ) {
        throw new Error("Некоректний запис у customCategories");
      }
    }
    out.customCategories = cc;
  }

  const dr = needArr(parsed.dismissedRecurring, "dismissedRecurring");
  if (dr) {
    for (const item of dr) {
      if (typeof item !== "string") {
        throw new Error("Некоректний запис у dismissedRecurring");
      }
    }
    out.dismissedRecurring = dr;
  }

  if (Object.keys(out).length === 0) {
    throw new Error(
      "У файлі немає даних для імпорту (очікуйте поля бекапу ФІНІК)",
    );
  }

  return out;
}

/**
 * Дані з ?sync= (компактні ключі b,s,a… або повний JSON бекапу).
 * @param {unknown} data — об'єкт після JSON.parse з URL
 * @returns {object} те саме, що normalizeFinykBackup, для applyData
 */
export function normalizeFinykSyncPayload(data) {
  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Некоректні дані синку");
  }

  const has = (k) => Object.prototype.hasOwnProperty.call(data, k);
  const looksLikeFullBackup =
    has("version") ||
    has("budgets") ||
    has("subscriptions") ||
    has("manualAssets") ||
    has("manualDebts") ||
    has("receivables") ||
    has("hiddenAccounts") ||
    has("hiddenTxIds") ||
    has("monthlyPlan") ||
    has("txCategories") ||
    has("txSplits") ||
    has("monoDebtLinkedTxIds") ||
    has("networthHistory") ||
    has("customCategories") ||
    has("dismissedRecurring");

  if (looksLikeFullBackup) {
    const withVer = has("version") ? data : { ...data, version: 1 };
    return normalizeFinykBackup(withVer);
  }

  const v = typeof data.v === "number" ? data.v : 1;
  if (v < 1 || v > 99) {
    throw new Error("Невідома версія синку");
  }

  const full = { version: FINYK_BACKUP_VERSION };
  if (has("b")) full.budgets = data.b;
  if (has("s")) full.subscriptions = data.s;
  if (has("a")) full.manualAssets = data.a;
  if (has("d")) full.manualDebts = data.d;
  if (has("r")) full.receivables = data.r;
  if (has("h")) full.hiddenAccounts = data.h;
  if (has("mp")) full.monthlyPlan = data.mp;
  if (has("tc")) full.txCategories = data.tc;
  if (has("ts")) full.txSplits = data.ts;
  if (has("md")) full.monoDebtLinkedTxIds = data.md;
  if (has("nh")) full.networthHistory = data.nh;
  if (has("cc")) full.customCategories = data.cc;
  if (has("dr")) full.dismissedRecurring = data.dr;

  return normalizeFinykBackup(full);
}
