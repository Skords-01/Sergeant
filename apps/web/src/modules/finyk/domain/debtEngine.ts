import { THEME_HEX } from "@shared/lib/themeHex.js";

export interface Debt {
  id: string;
  amount: number;
  linkedTxIds?: string[];
  totalAmount?: number;
}

export interface Receivable {
  id: string;
  amount: number;
  linkedTxIds?: string[];
}

export interface Tx {
  id: string;
  amount: number;
}

export interface TxRole {
  kind: "origin" | "payment";
  label: string;
  color: string;
}

function toAmountUAH(tx: Tx): number {
  return Math.abs((tx?.amount || 0) / 100);
}

function findLinkedTx(
  linkedTxIds: string[] = [],
  transactions: Tx[] = [],
): Tx[] {
  const index = new Map(transactions.map((tx) => [tx.id, tx]));
  return linkedTxIds
    .map((id) => index.get(id))
    .filter((tx): tx is Tx => tx !== undefined);
}

export function getDebtTxRole(tx: Pick<Tx, "amount">): TxRole {
  return tx.amount > 0
    ? { kind: "origin", label: "📥 Виникнення боргу", color: THEME_HEX.danger }
    : { kind: "payment", label: "✅ Сплата боргу", color: THEME_HEX.success };
}

export function getReceivableTxRole(tx: Pick<Tx, "amount">): TxRole {
  return tx.amount < 0
    ? { kind: "origin", label: "📤 Виникнення боргу", color: THEME_HEX.danger }
    : {
        kind: "payment",
        label: "✅ Погашення боргу",
        color: THEME_HEX.success,
      };
}

export function getDebtPaid(debt: Debt, transactions: Tx[] = []): number {
  const linked = findLinkedTx(debt?.linkedTxIds || [], transactions);
  return linked
    .filter((tx) => tx.amount < 0)
    .reduce((sum, tx) => sum + toAmountUAH(tx), 0);
}

export function getDebtOriginated(debt: Debt, transactions: Tx[] = []): number {
  const linked = findLinkedTx(debt?.linkedTxIds || [], transactions);
  return linked
    .filter((tx) => tx.amount > 0)
    .reduce((sum, tx) => sum + toAmountUAH(tx), 0);
}

export function getReceivablePaid(
  receivable: Receivable,
  transactions: Tx[] = [],
): number {
  const linked = findLinkedTx(receivable?.linkedTxIds || [], transactions);
  return linked
    .filter((tx) => tx.amount > 0)
    .reduce((sum, tx) => sum + toAmountUAH(tx), 0);
}

export function getReceivableOriginated(
  receivable: Receivable,
  transactions: Tx[] = [],
): number {
  const linked = findLinkedTx(receivable?.linkedTxIds || [], transactions);
  return linked
    .filter((tx) => tx.amount < 0)
    .reduce((sum, tx) => sum + toAmountUAH(tx), 0);
}

export function getDebtEffectiveTotal(
  debt: Debt,
  transactions: Tx[] = [],
): number {
  return Number(debt?.totalAmount || 0) + getDebtOriginated(debt, transactions);
}

export function getReceivableEffectiveTotal(
  receivable: Receivable,
  transactions: Tx[] = [],
): number {
  return (
    Number(receivable?.amount || 0) +
    getReceivableOriginated(receivable, transactions)
  );
}

export function calcDebtRemaining(debt: Debt, transactions: Tx[] = []): number {
  return Math.max(
    0,
    getDebtEffectiveTotal(debt, transactions) - getDebtPaid(debt, transactions),
  );
}

export function calcReceivableRemaining(
  receivable: Receivable,
  transactions: Tx[] = [],
): number {
  return Math.max(
    0,
    getReceivableEffectiveTotal(receivable, transactions) -
      getReceivablePaid(receivable, transactions),
  );
}
