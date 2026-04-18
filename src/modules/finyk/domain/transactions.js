/**
 * @typedef {'monobank'|'privatbank'|'manual'|'unknown'} TransactionSource
 */

/**
 * Unified transaction entity for Finyk domain.
 *
 * @typedef {Object} Transaction
 * @property {string} id
 * @property {number} time Unix timestamp in seconds
 * @property {number} amount Signed amount in minor units (kopecks)
 * @property {string} description
 * @property {number} mcc
 * @property {string|null} accountId
 * @property {TransactionSource} source
 * @property {boolean} manual
 * @property {string|undefined} manualId
 * @property {Object|undefined} raw
 */

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

/**
 * Normalizes any provider/manual transaction into unified domain Transaction.
 *
 * @param {Object} input
 * @param {Object} [defaults]
 * @returns {Transaction}
 */
export function normalizeTransaction(input, defaults = {}) {
  const tx = input || {};
  const source =
    tx.source ||
    tx._source ||
    defaults.source ||
    (tx._manual ? "manual" : "unknown");

  const manual = Boolean(tx.manual ?? tx._manual ?? source === "manual");
  const manualId = tx.manualId ?? tx._manualId;
  const accountId = tx.accountId ?? tx._accountId ?? defaults.accountId ?? null;
  const amount = Number(tx.amount);
  const normalizedAmount = Number.isFinite(amount) ? Math.round(amount) : 0;
  const time = toSafeTimestampSeconds(tx.time ?? tx.date ?? tx.createdAt);

  const fallbackId = `${source}_${time}_${normalizedAmount}_${Math.random().toString(36).slice(2, 8)}`;

  return {
    id: String(tx.id || fallbackId),
    time,
    amount: normalizedAmount,
    description: String(tx.description || ""),
    mcc: Number.isFinite(Number(tx.mcc)) ? Number(tx.mcc) : 0,
    accountId: accountId == null ? null : String(accountId),
    source,
    manual,
    manualId: manualId == null ? undefined : String(manualId),
    raw: tx.raw || undefined,

    // Backward-compatible fields used across module UI.
    _source: source,
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
