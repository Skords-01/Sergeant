/** Версія формату експорту JSON (бекап). */
export const FINYK_BACKUP_VERSION = 2;

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
    if (typeof v !== "object" || Array.isArray(v)) throw new Error(`Поле «${name}» має бути об'єктом`);
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
    if (typeof parsed.monthlyPlan !== "object" || Array.isArray(parsed.monthlyPlan)) {
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

  if (Object.keys(out).length === 0) {
    throw new Error("У файлі немає даних для імпорту (очікуйте поля бекапу ФІНІК)");
  }

  return out;
}
