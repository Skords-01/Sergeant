import { THEME_HEX } from "@shared/lib/themeHex.js";

/**
 * @typedef {{ id: string, amount: number, linkedTxIds?: string[], totalAmount?: number }} Debt
 * A debt record (money owed by the user to someone else).
 */

/**
 * @typedef {{ id: string, amount: number, linkedTxIds?: string[] }} Receivable
 * A receivable record (money owed to the user by someone else).
 */

/**
 * @typedef {{ id: string, amount: number }} Tx
 * A Monobank transaction with at minimum `id` and signed `amount` (kopiykas).
 */

/**
 * @typedef {{ kind: 'origin'|'payment', label: string, color: string }} TxRole
 * Display metadata for a transaction's role within a debt/receivable.
 */

/**
 * Convert a transaction amount from kopiykas to UAH (unsigned).
 * @param {Tx} tx
 * @returns {number} Absolute UAH amount.
 */
function toAmountUAH(tx) {
  return Math.abs((tx?.amount || 0) / 100);
}

/**
 * Find transaction objects by their IDs from a flat transactions array.
 * @param {string[]} linkedTxIds
 * @param {Tx[]} transactions
 * @returns {Tx[]}
 */
function findLinkedTx(linkedTxIds = [], transactions = []) {
  const index = new Map(transactions.map((tx) => [tx.id, tx]));
  return linkedTxIds.map((id) => index.get(id)).filter(Boolean);
}

/**
 * Determine the display role of a linked transaction for a **debt**
 * (money the user owes). Positive transactions are debt originations;
 * negative are payments.
 * @param {{ amount: number }} tx
 * @returns {TxRole}
 */
export function getDebtTxRole(tx) {
  return tx.amount > 0
    ? {
        kind: "origin",
        label: "📥 Виникнення боргу",
        color: THEME_HEX.danger,
      }
    : { kind: "payment", label: "✅ Сплата боргу", color: THEME_HEX.success };
}

/**
 * Determine the display role of a linked transaction for a **receivable**
 * (money owed to the user). Negative transactions are originations (lending);
 * positive are repayments.
 * @param {{ amount: number }} tx
 * @returns {TxRole}
 */
export function getReceivableTxRole(tx) {
  return tx.amount < 0
    ? {
        kind: "origin",
        label: "📤 Виникнення боргу",
        color: THEME_HEX.danger,
      }
    : {
        kind: "payment",
        label: "✅ Погашення боргу",
        color: THEME_HEX.success,
      };
}

/**
 * Sum of all *payments* made toward a debt (linked transactions with amount < 0).
 * @param {Debt} debt
 * @param {Tx[]} transactions - Full transaction list to resolve linked IDs.
 * @returns {number} Total paid in UAH.
 */
export function getDebtPaid(debt, transactions = []) {
  const linked = findLinkedTx(debt?.linkedTxIds || [], transactions);
  return linked
    .filter((tx) => tx.amount < 0)
    .reduce((sum, tx) => sum + toAmountUAH(tx), 0);
}

/**
 * Sum of additional debt that originated via linked transactions (amount > 0).
 * @param {Debt} debt
 * @param {Tx[]} transactions
 * @returns {number} Total originated in UAH.
 */
export function getDebtOriginated(debt, transactions = []) {
  const linked = findLinkedTx(debt?.linkedTxIds || [], transactions);
  return linked
    .filter((tx) => tx.amount > 0)
    .reduce((sum, tx) => sum + toAmountUAH(tx), 0);
}

/**
 * Sum of repayments received for a receivable (linked transactions with amount > 0).
 * @param {Receivable} receivable
 * @param {Tx[]} transactions
 * @returns {number} Total received in UAH.
 */
export function getReceivablePaid(receivable, transactions = []) {
  const linked = findLinkedTx(receivable?.linkedTxIds || [], transactions);
  return linked
    .filter((tx) => tx.amount > 0)
    .reduce((sum, tx) => sum + toAmountUAH(tx), 0);
}

/**
 * Sum of additional amounts lent via linked transactions for a receivable (amount < 0).
 * @param {Receivable} receivable
 * @param {Tx[]} transactions
 * @returns {number} Total originated in UAH.
 */
export function getReceivableOriginated(receivable, transactions = []) {
  const linked = findLinkedTx(receivable?.linkedTxIds || [], transactions);
  return linked
    .filter((tx) => tx.amount < 0)
    .reduce((sum, tx) => sum + toAmountUAH(tx), 0);
}

/**
 * Effective total debt including amounts that originated via linked transactions.
 * @param {Debt} debt
 * @param {Tx[]} transactions
 * @returns {number} Total effective debt in UAH.
 */
export function getDebtEffectiveTotal(debt, transactions = []) {
  return Number(debt?.totalAmount || 0) + getDebtOriginated(debt, transactions);
}

/**
 * Effective total of a receivable including amounts lent via linked transactions.
 * @param {Receivable} receivable
 * @param {Tx[]} transactions
 * @returns {number} Total effective receivable in UAH.
 */
export function getReceivableEffectiveTotal(receivable, transactions = []) {
  return (
    Number(receivable?.amount || 0) +
    getReceivableOriginated(receivable, transactions)
  );
}

/**
 * Remaining unpaid amount for a debt (≥ 0).
 * @param {Debt} debt
 * @param {Tx[]} transactions
 * @returns {number} Remaining debt in UAH.
 */
export function calcDebtRemaining(debt, transactions = []) {
  return Math.max(
    0,
    getDebtEffectiveTotal(debt, transactions) - getDebtPaid(debt, transactions),
  );
}

/**
 * Remaining unreceived amount for a receivable (≥ 0).
 * @param {Receivable} receivable
 * @param {Tx[]} transactions
 * @returns {number} Remaining receivable in UAH.
 */
export function calcReceivableRemaining(receivable, transactions = []) {
  return Math.max(
    0,
    getReceivableEffectiveTotal(receivable, transactions) -
      getReceivablePaid(receivable, transactions),
  );
}
