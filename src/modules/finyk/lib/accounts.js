import { CURRENCY } from "../constants";

export function getMonoDebt(acc) {
  if (acc.creditLimit > 0)
    return Math.max(0, (acc.creditLimit - acc.balance) / 100);
  if (acc.balance < 0) return Math.abs(acc.balance) / 100;
  return 0;
}

export function isMonoDebt(acc) {
  return acc.creditLimit > 0 && acc.creditLimit - acc.balance > 0;
}

export function daysUntil(day) {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), day);
  if (target <= now) target.setMonth(target.getMonth() + 1);
  return Math.ceil((target - now) / 86400000);
}

export function getMonthStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export function getMonoTotals(accounts, hiddenAccountIds = []) {
  const visible = accounts.filter((a) => !hiddenAccountIds.includes(a.id));
  const balance = visible
    .filter(
      (a) => a.balance > 0 && !a.creditLimit && a.currencyCode === CURRENCY.UAH,
    )
    .reduce((sum, a) => sum + a.balance / 100, 0);
  const debt = accounts
    .filter((a) => isMonoDebt(a))
    .reduce((sum, a) => sum + getMonoDebt(a), 0);
  return { balance, debt };
}
