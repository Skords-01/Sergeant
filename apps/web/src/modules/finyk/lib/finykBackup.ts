import { DEFAULT_SUBSCRIPTIONS } from "../constants.js";
import { notifyFinykRoutineCalendarSync } from "../hubRoutineSync.js";
import { readJSON, writeJSON } from "./finykStorage.js";

/** Версія формату експорту JSON (бекап). */
export const FINYK_BACKUP_VERSION = 3;

/**
 * Shape of the JSON backup written/read by Finyk. Fields are intentionally
 * loose — the backup covers untyped legacy persisted data.
 */
export interface FinykBackup {
  version?: number;
  budgets?: unknown[];
  subscriptions?: unknown[];
  manualAssets?: unknown[];
  manualDebts?: unknown[];
  receivables?: unknown[];
  hiddenAccounts?: unknown[];
  hiddenTxIds?: unknown[];
  monthlyPlan?: Record<string, unknown>;
  txCategories?: Record<string, unknown>;
  txSplits?: Record<string, unknown>;
  monoDebtLinkedTxIds?: Record<string, unknown>;
  networthHistory?: unknown[];
  customCategories?: unknown[];
  dismissedRecurring?: unknown[];
}

const DEFAULT_MONTHLY_PLAN = { income: "", expense: "", savings: "" };

function readJsonFromLocalStorage<T>(key: string, fallback: T): T {
  return readJSON(key, fallback) as T;
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
export function persistFinykNormalizedToStorage(normalized: FinykBackup): void {
  for (const [field, storageKey] of Object.entries(
    FINYK_FIELD_TO_STORAGE_KEY,
  )) {
    const value = (normalized as Record<string, unknown>)[field];
    if (value !== undefined) {
      writeJSON(storageKey, value);
    }
  }
  notifyFinykRoutineCalendarSync();
}

/**
 * Перевіряє та нормалізує об'єкт бекапу для застосування в сховище.
 * Підтримує version 1 (без категорій/сплітів) і 2 (повний набір).
 */
export function normalizeFinykBackup(parsed: unknown): FinykBackup {
  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Файл має містити JSON-об'єкт");
  }
  const obj = parsed as Record<string, unknown>;
  if (Object.keys(obj).length === 0) {
    throw new Error("Порожній об'єкт у файлі");
  }

  const version = typeof obj.version === "number" ? obj.version : 1;
  if (version < 1 || version > 999) {
    throw new Error("Невідома версія бекапу");
  }

  const out: FinykBackup = {};

  const needArr = (v: unknown, name: string): unknown[] | undefined => {
    if (v === undefined || v === null) return undefined;
    if (!Array.isArray(v)) throw new Error(`Поле «${name}» має бути масивом`);
    return v;
  };
  const needObj = (
    v: unknown,
    name: string,
  ): Record<string, unknown> | undefined => {
    if (v === undefined || v === null) return undefined;
    if (typeof v !== "object" || Array.isArray(v))
      throw new Error(`Поле «${name}» має бути об'єктом`);
    return v as Record<string, unknown>;
  };

  const b = needArr(obj.budgets, "budgets");
  if (b) out.budgets = b;
  const s = needArr(obj.subscriptions, "subscriptions");
  if (s) out.subscriptions = s;
  const ma = needArr(obj.manualAssets, "manualAssets");
  if (ma) out.manualAssets = ma;
  const md = needArr(obj.manualDebts, "manualDebts");
  if (md) out.manualDebts = md;
  const r = needArr(obj.receivables, "receivables");
  if (r) out.receivables = r;
  const ha = needArr(obj.hiddenAccounts, "hiddenAccounts");
  if (ha) out.hiddenAccounts = ha;
  const ht = needArr(obj.hiddenTxIds, "hiddenTxIds");
  if (ht) out.hiddenTxIds = ht;

  if (obj.monthlyPlan !== undefined && obj.monthlyPlan !== null) {
    if (typeof obj.monthlyPlan !== "object" || Array.isArray(obj.monthlyPlan)) {
      throw new Error("Поле «monthlyPlan» має бути об'єктом");
    }
    out.monthlyPlan = obj.monthlyPlan as Record<string, unknown>;
  }

  const tc = needObj(obj.txCategories, "txCategories");
  if (tc) out.txCategories = tc;
  const ts = needObj(obj.txSplits, "txSplits");
  if (ts) out.txSplits = ts;
  const mdl = needObj(obj.monoDebtLinkedTxIds, "monoDebtLinkedTxIds");
  if (mdl) out.monoDebtLinkedTxIds = mdl;

  if (obj.networthHistory !== undefined && obj.networthHistory !== null) {
    const nh = needArr(obj.networthHistory, "networthHistory");
    if (nh) {
      for (const row of nh) {
        if (
          !row ||
          typeof row !== "object" ||
          typeof (row as { month?: unknown }).month !== "string"
        ) {
          throw new Error("Некоректний запис у networthHistory");
        }
      }
      out.networthHistory = nh;
    }
  }

  const cc = needArr(obj.customCategories, "customCategories");
  if (cc) {
    for (const row of cc) {
      const r = row as { id?: unknown; label?: unknown } | null;
      if (
        !r ||
        typeof r !== "object" ||
        typeof r.id !== "string" ||
        typeof r.label !== "string"
      ) {
        throw new Error("Некоректний запис у customCategories");
      }
    }
    out.customCategories = cc;
  }

  const dr = needArr(obj.dismissedRecurring, "dismissedRecurring");
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
 * Повертає те саме, що normalizeFinykBackup, для applyData.
 */
export function normalizeFinykSyncPayload(data: unknown): FinykBackup {
  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Некоректні дані синку");
  }
  const d = data as Record<string, unknown>;

  const has = (k: string) => Object.prototype.hasOwnProperty.call(d, k);
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
    const withVer = has("version") ? d : { ...d, version: 1 };
    return normalizeFinykBackup(withVer);
  }

  const v = typeof d.v === "number" ? d.v : 1;
  if (v < 1 || v > 99) {
    throw new Error("Невідома версія синку");
  }

  const full: FinykBackup = { version: FINYK_BACKUP_VERSION };
  if (has("b")) full.budgets = d.b as unknown[];
  if (has("s")) full.subscriptions = d.s as unknown[];
  if (has("a")) full.manualAssets = d.a as unknown[];
  if (has("d")) full.manualDebts = d.d as unknown[];
  if (has("r")) full.receivables = d.r as unknown[];
  if (has("h")) full.hiddenAccounts = d.h as unknown[];
  if (has("mp")) full.monthlyPlan = d.mp as Record<string, unknown>;
  if (has("tc")) full.txCategories = d.tc as Record<string, unknown>;
  if (has("ts")) full.txSplits = d.ts as Record<string, unknown>;
  if (has("md")) full.monoDebtLinkedTxIds = d.md as Record<string, unknown>;
  if (has("nh")) full.networthHistory = d.nh as unknown[];
  if (has("cc")) full.customCategories = d.cc as unknown[];
  if (has("dr")) full.dismissedRecurring = d.dr as unknown[];

  return normalizeFinykBackup(full);
}
