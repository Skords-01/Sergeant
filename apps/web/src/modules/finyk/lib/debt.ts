import {
  getDebtPaid as debtEngineGetDebtPaid,
  getReceivablePaid,
  calcDebtRemaining,
  calcReceivableRemaining,
  getDebtEffectiveTotal,
  getReceivableEffectiveTotal,
} from "../domain/debtEngine";

export {
  calcDebtRemaining,
  calcReceivableRemaining,
  getDebtEffectiveTotal,
  getReceivableEffectiveTotal,
};

// Скільки сплачено по боргу (я винен):
// тільки від'ємні транзакції (витрати) = погашення боргу
export function getDebtPaid(debt, transactions) {
  return debtEngineGetDebtPaid(debt, transactions);
}

// Скільки повернено по дебіторці (мені винні):
// тільки позитивні транзакції (надходження) = погашення боргу
export function getRecvPaid(recv, transactions) {
  return getReceivablePaid(recv, transactions);
}
