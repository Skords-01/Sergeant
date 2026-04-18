/**
 * Уніфікована модель транзакції Фініка.
 *
 * Нормалізована форма ОДНА для всіх джерел: manual, monobank, ai, import.
 * Включає канонічні поля (date/categoryId/type/merchant/note) та legacy-поля
 * (time/description/mcc/_source/_accountId…), щоб не ламати існуючий UI
 * та сумісність зі старими даними в localStorage.
 *
 * amount — у signed minor units (копійках), як і раніше. UI-код навколо
 * очікує саме такий формат, тож одиниці зберігаємо, а нові поля лише додаємо.
 */

/**
 * @typedef {'expense'|'income'|'transfer'} TransactionType
 */

/**
 * Канонічні джерела транзакцій.
 * @typedef {'manual'|'mono'|'ai'|'import'} TransactionSource
 */

/**
 * @typedef {Object} Transaction
 * @property {string} id
 * @property {number} amount Signed amount in minor units (kopecks).
 * @property {string} date ISO-8601 datetime string.
 * @property {string} categoryId Category id (empty string if невідома).
 * @property {TransactionType} type 'expense' | 'income' | 'transfer'
 * @property {string} [merchant] Merchant name (опційно).
 * @property {string} [note] Freeform note (опційно).
 * @property {TransactionSource} source Канонічне джерело.
 *
 * Legacy/back-compat (для існуючого UI та персистованих даних):
 * @property {number} time Unix timestamp in seconds.
 * @property {string} description
 * @property {number} mcc
 * @property {string|null} accountId
 * @property {boolean} manual
 * @property {string|undefined} manualId
 * @property {Object|undefined} raw
 * @property {string} _source Оригінальна назва джерела (monobank/privatbank/…).
 * @property {string|null} _accountId
 * @property {boolean} _manual
 * @property {string|undefined} _manualId
 */

import { INTERNAL_TRANSFER_ID } from "../constants";

// Внутрішні category ids, які трактуються як переказ між власними рахунками.
const TRANSFER_CATEGORY_IDS = new Set([INTERNAL_TRANSFER_ID, "transfer"]);

// Назви джерел у "сирому" вигляді → канонічні TransactionSource.
const SOURCE_ALIASES = {
  manual: "manual",
  mono: "mono",
  monobank: "mono",
  ai: "ai",
  "ai-analysis": "ai",
  import: "import",
  privat: "import",
  privatbank: "import",
};

/**
 * Приводить довільне значення дати/часу до unix timestamp (секунди).
 * Підтримує: number (мс або сек), Date, ISO-рядок, YYYY-MM-DD тощо.
 */
function toSafeTimestampSeconds(input) {
  if (typeof input === "number" && Number.isFinite(input)) {
    // Якщо це мілісекунди (10^10 межа для секунд — приблизно 2286 рік).
    return input > 10_000_000_000
      ? Math.floor(input / 1000)
      : Math.floor(input);
  }
  if (input instanceof Date) return Math.floor(input.getTime() / 1000);
  const parsed = new Date(input || Date.now()).getTime();
  return Number.isFinite(parsed)
    ? Math.floor(parsed / 1000)
    : Math.floor(Date.now() / 1000);
}

// Мінімум до копійок; число → round; інше → 0. Уникаємо -0.
function toSafeAmountMinorUnits(input) {
  const n = Number(input);
  if (!Number.isFinite(n)) return 0;
  const rounded = Math.round(n);
  return rounded === 0 ? 0 : rounded;
}

// Канонічне джерело з будь-якого alias, з фолбеком на defaults/manual-детект.
function resolveSource(input, defaults) {
  const raw =
    input?.source ??
    input?._source ??
    defaults?.source ??
    (input?._manual || input?.manual ? "manual" : null);
  if (!raw) return "import";
  const key = String(raw).toLowerCase();
  return SOURCE_ALIASES[key] || "import";
}

// Тип транзакції: якщо категорія — внутрішній переказ → 'transfer';
// інакше за знаком суми.
function resolveType(categoryId, amount, explicitType) {
  if (
    explicitType === "expense" ||
    explicitType === "income" ||
    explicitType === "transfer"
  ) {
    return explicitType;
  }
  if (categoryId && TRANSFER_CATEGORY_IDS.has(categoryId)) return "transfer";
  return amount > 0 ? "income" : "expense";
}

// Витягує categoryId з різних форм сирого input.
function resolveCategoryId(input) {
  if (!input) return "";
  if (typeof input.categoryId === "string" && input.categoryId) {
    return input.categoryId;
  }
  // manual-транзакції зберігають id категорії у raw.category або в полі category.
  const raw = input.raw && typeof input.raw === "object" ? input.raw : null;
  const fromRaw = raw && typeof raw.category === "string" ? raw.category : "";
  const fromInput = typeof input.category === "string" ? input.category : "";
  return fromRaw || fromInput || "";
}

// merchant: явне поле > merchantName/vendor > опис для банківських джерел.
function resolveMerchant(input, source) {
  if (!input) return undefined;
  if (typeof input.merchant === "string" && input.merchant.trim()) {
    return input.merchant.trim();
  }
  if (typeof input.merchantName === "string" && input.merchantName.trim()) {
    return input.merchantName.trim();
  }
  // Для mono/import description ≈ merchant; для manual краще не дублювати.
  if (
    (source === "mono" || source === "import") &&
    typeof input.description === "string"
  ) {
    const d = input.description.trim();
    return d || undefined;
  }
  return undefined;
}

// note: явне поле > comment > для manual — description.
function resolveNote(input, source) {
  if (!input) return undefined;
  if (typeof input.note === "string" && input.note.trim()) {
    return input.note.trim();
  }
  if (typeof input.comment === "string" && input.comment.trim()) {
    return input.comment.trim();
  }
  if (source === "manual" && typeof input.description === "string") {
    const d = input.description.trim();
    return d || undefined;
  }
  return undefined;
}

/**
 * Нормалізує довільну “сиру” транзакцію у єдину модель Transaction.
 *
 * Генерує id, приводить date до ISO, гарантує що amount — number,
 * заповнює дефолти відсутніх полів та зберігає legacy-поля для сумісності.
 *
 * @param {Object} input
 * @param {Object} [defaults]
 * @param {TransactionSource|string} [defaults.source]
 * @param {string|null} [defaults.accountId]
 * @param {string} [defaults.categoryId]
 * @returns {Transaction}
 */
export function normalizeTransaction(input, defaults = {}) {
  const tx = input || {};
  const source = resolveSource(tx, defaults);

  const manual = Boolean(tx.manual ?? tx._manual ?? source === "manual");
  const manualId = tx.manualId ?? tx._manualId;
  const accountId = tx.accountId ?? tx._accountId ?? defaults.accountId ?? null;
  const normalizedAmount = toSafeAmountMinorUnits(tx.amount);
  const time = toSafeTimestampSeconds(tx.time ?? tx.date ?? tx.createdAt);
  const date = new Date(time * 1000).toISOString();

  const categoryId =
    resolveCategoryId(tx) ||
    (defaults.categoryId ? String(defaults.categoryId) : "");
  const type = resolveType(categoryId, normalizedAmount, tx.type);
  const merchant = resolveMerchant(tx, source);
  const note = resolveNote(tx, source);

  // Стабільний id: або власний, або детермінований від source/time/amount + рандомний хвіст.
  const fallbackId = `${source}_${time}_${normalizedAmount}_${Math.random().toString(36).slice(2, 8)}`;

  // legacy _source: якщо на вхід приходив оригінальний label (monobank/privatbank/unknown)
  // — зберігаємо його для існуючих перевірок у UI (TxRow і т.п.).
  const legacySource =
    typeof tx._source === "string" && tx._source
      ? tx._source
      : typeof tx.source === "string" && tx.source
        ? tx.source
        : typeof defaults.source === "string" && defaults.source
          ? defaults.source
          : source;

  return {
    // Канонічні поля — єдиний формат для всіх споживачів логіки.
    id: String(tx.id || fallbackId),
    amount: normalizedAmount,
    date,
    categoryId,
    type,
    merchant,
    note,
    source,

    // Legacy-поля для сумісності з існуючим UI та старими даними.
    time,
    description: String(tx.description || ""),
    mcc: Number.isFinite(Number(tx.mcc)) ? Number(tx.mcc) : 0,
    accountId: accountId == null ? null : String(accountId),
    manual,
    manualId: manualId == null ? undefined : String(manualId),
    raw: tx.raw || undefined,

    _source: legacySource,
    _accountId: accountId == null ? null : String(accountId),
    _manual: manual,
    _manualId: manualId == null ? undefined : String(manualId),
  };
}

export function normalizeTransactions(items, defaults = {}) {
  const list = Array.isArray(items) ? items : [];
  return list.map((tx) => normalizeTransaction(tx, defaults));
}

export function dedupeAndSortTransactions(items) {
  const map = new Map();
  for (const tx of normalizeTransactions(items)) map.set(tx.id, tx);
  return Array.from(map.values()).sort((a, b) => (b.time || 0) - (a.time || 0));
}

/**
 * Перетворює збережену manual-витрату (`addManualExpense`-entry) у
 * нормалізовану Transaction. Зберігає amount у копійках зі знаком "витрата"
 * та проставляє categoryId з поля `category`.
 *
 * @param {{ id:string|number, date?:string, description?:string, amount:number, category?:string }} entry
 * @returns {Transaction}
 */
export function manualExpenseToTransaction(entry) {
  const e = entry || {};
  const time = e.date ? Math.floor(new Date(e.date).getTime() / 1000) : 0;
  return normalizeTransaction(
    {
      id: `manual_${e.id}`,
      manual: true,
      manualId: e.id,
      time,
      // UI зберігає amount як додатнє число у гривнях → конвертуємо у мінус-копійки.
      amount: -Math.abs(Math.round(Number(e.amount || 0) * 100)),
      description: e.description || "",
      mcc: 0,
      raw: { category: e.category },
    },
    { source: "manual", accountId: null, categoryId: e.category || "" },
  );
}
