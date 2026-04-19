/**
 * Уніфікована модель транзакції модуля Finyk.
 *
 * Будь-яка транзакція (manual, Monobank, AI-розбір, імпорт) проходить через
 * normalizeTransaction() перед тим як потрапити у внутрішню логіку селекторів
 * та UI. Мета — прибрати «сирі» формати з домену.
 *
 * Конвенції поля amount:
 *   • Signed integer у мінорних одиницях (копійках). Така конвенція історично
 *     закладена в модулі: Monobank API віддає кілокопійки, статистика/графіки
 *     діляться на 100 на рівні UI. Якщо вхід — float (гривні), normalizeAmount
 *     приведе його до цілих копійок.
 *
 * @typedef {'expense'|'income'|'transfer'} TransactionType
 * @typedef {'manual'|'mono'|'ai'|'import'} TransactionSource
 * @typedef {'monobank'|'privatbank'|'manual'|'unknown'} LegacyTransactionSource
 */

/**
 * @typedef {Object} Transaction
 * Канонічні поля:
 * @property {string} id
 * @property {number} amount Signed int у копійках.
 * @property {string} date ISO-8601 рядок.
 * @property {string} categoryId Порожній рядок, якщо ще не відома.
 * @property {TransactionType} type
 * @property {TransactionSource} source
 * @property {string} [merchant] Назва контрагента/мерчанта.
 * @property {string} [note] Довільна примітка.
 *
 * Легасі-поля для сумісності з існуючим UI і даними в localStorage:
 * @property {number} time Unix timestamp у секундах.
 * @property {string} description Аліас merchant.
 * @property {number} mcc
 * @property {string|null} accountId
 * @property {boolean} manual
 * @property {string|undefined} manualId
 * @property {LegacyTransactionSource} _source
 * @property {string|null} _accountId
 * @property {boolean} _manual
 * @property {string|undefined} _manualId
 * @property {Object|undefined} raw
 */

// Маппінг «старий формат» → «новий канонічний» і навпаки.
const LEGACY_TO_CANONICAL_SOURCE = {
  monobank: "mono",
  mono: "mono",
  privatbank: "import",
  import: "import",
  manual: "manual",
  ai: "ai",
  unknown: "manual",
};

const CANONICAL_TO_LEGACY_SOURCE = {
  mono: "monobank",
  import: "privatbank",
  manual: "manual",
  ai: "manual",
};

function toCanonicalSource(raw) {
  if (!raw) return null;
  return LEGACY_TO_CANONICAL_SOURCE[String(raw)] || null;
}

function toLegacySource(raw) {
  if (!raw) return null;
  const key = String(raw);
  if (LEGACY_TO_CANONICAL_SOURCE[key] && key in CANONICAL_TO_LEGACY_SOURCE) {
    return CANONICAL_TO_LEGACY_SOURCE[key];
  }
  // Приймаємо як легасі-значення (monobank/privatbank/manual/unknown).
  if (key === "monobank" || key === "privatbank" || key === "manual")
    return key;
  return null;
}

function toSafeTimestampSeconds(input) {
  if (typeof input === "number" && Number.isFinite(input)) {
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

// amount: int → вважаємо копійками; float → гривні, переводимо в копійки.
function normalizeAmount(input) {
  const n = Number(input);
  if (!Number.isFinite(n)) return 0;
  if (Number.isInteger(n)) return n;
  return Math.round(n * 100);
}

function generateId(prefix) {
  try {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return `${prefix || "tx"}_${crypto.randomUUID()}`;
    }
  } catch {}
  return `${prefix || "tx"}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function pickCategoryId(input) {
  if (input.categoryId != null && input.categoryId !== "")
    return String(input.categoryId);
  if (input.raw && input.raw.category != null && input.raw.category !== "")
    return String(input.raw.category);
  if (input.category != null && input.category !== "")
    return String(input.category);
  return "";
}

function deriveType(input, amount) {
  if (
    input.type === "transfer" ||
    input.type === "income" ||
    input.type === "expense"
  ) {
    return input.type;
  }
  if (amount > 0) return "income";
  return "expense";
}

function pickString(value) {
  if (value == null) return "";
  return String(value).trim();
}

/**
 * Нормалізує будь-яку «сиру» транзакцію до канонічної моделі Transaction.
 *
 * Гарантує:
 *   • id — згенерує, якщо відсутній;
 *   • date — ISO-рядок (з date/time/createdAt/raw);
 *   • amount — число (signed int у копійках);
 *   • categoryId/type/source — мають дефолти;
 *   • merchant/description — синхронізовано (старий UI читає description);
 *   • Легасі-поля (_source, _manual, time, mcc, ...) — збережено.
 *
 * @param {Object} input
 * @param {Object} [defaults]
 * @returns {Transaction}
 */
export function normalizeTransaction(input, defaults = {}) {
  const tx = input || {};
  const d = defaults || {};

  const source =
    toCanonicalSource(tx.source) ||
    toCanonicalSource(tx._source) ||
    toCanonicalSource(d.source) ||
    (tx.manual || tx._manual ? "manual" : "manual");

  const legacySource =
    toLegacySource(tx._source) ||
    toLegacySource(tx.source) ||
    toLegacySource(d.source) ||
    CANONICAL_TO_LEGACY_SOURCE[source] ||
    "unknown";

  const manual = Boolean(tx.manual ?? tx._manual ?? source === "manual");
  const manualId = tx.manualId ?? tx._manualId;
  const accountId = tx.accountId ?? tx._accountId ?? d.accountId ?? null;

  const amount = normalizeAmount(tx.amount);
  const time = toSafeTimestampSeconds(tx.time ?? tx.date ?? tx.createdAt);
  const dateIso = new Date(time * 1000).toISOString();

  const merchant = pickString(tx.merchant ?? tx.description);
  const note = tx.note != null ? String(tx.note) : undefined;
  const categoryId = pickCategoryId(tx);
  const type = deriveType(tx, amount);

  const id =
    tx.id != null && tx.id !== ""
      ? String(tx.id)
      : manual && manualId != null
        ? `manual_${manualId}`
        : generateId(source);

  return {
    // ── Канонічні поля уніфікованої моделі ───────────────────────
    id,
    amount,
    date: dateIso,
    categoryId,
    type,
    source,
    merchant: merchant || undefined,
    note,

    // ── Легасі-поля, які читає існуючий UI/селектори ─────────────
    time,
    description: merchant,
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

/**
 * Зручний шорткат для ручних витрат з localStorage (finyk_manual_expenses_v1),
 * де amount зберігається в гривнях (позитивне число), а категорія — окремим полем.
 *
 * @param {{ id?: string, date?: string, description?: string, amount?: number, category?: string }} expense
 * @returns {Transaction}
 */
export function normalizeManualExpense(expense) {
  const e = expense || {};
  const manualId = e.id != null ? String(e.id) : undefined;
  const amountHryvnia = Math.abs(Number(e.amount) || 0);
  return normalizeTransaction(
    {
      id: manualId ? `manual_${manualId}` : undefined,
      manual: true,
      manualId,
      date: e.date || new Date().toISOString(),
      amount: -Math.round(amountHryvnia * 100),
      description: e.description,
      mcc: 0,
      categoryId: e.category,
      raw: { category: e.category },
    },
    { source: "manual", accountId: null },
  );
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
