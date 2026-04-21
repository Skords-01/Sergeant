import { CURRENCY } from "../constants";

export interface MonoAccount {
  id?: string;
  balance: number;
  creditLimit?: number;
  currencyCode?: number;
  type?: string;
}

export function getMonoDebt(acc: MonoAccount): number {
  const creditLimit = acc.creditLimit ?? 0;
  if (creditLimit > 0) return Math.max(0, (creditLimit - acc.balance) / 100);
  if (acc.balance < 0) return Math.abs(acc.balance) / 100;
  return 0;
}

export function isMonoDebt(acc: MonoAccount): boolean {
  const creditLimit = acc.creditLimit ?? 0;
  return creditLimit > 0 && creditLimit - acc.balance > 0;
}

export function daysUntil(day: number): number {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), day);
  if (target <= now) target.setMonth(target.getMonth() + 1);
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

export function getMonthStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export function getMonoTotals(
  accounts: MonoAccount[],
  hiddenAccountIds: string[] = [],
): { balance: number; debt: number } {
  const visible = accounts.filter(
    (a) => !(a.id !== undefined && hiddenAccountIds.includes(a.id)),
  );
  const balance = visible
    .filter(
      (a) =>
        a.balance > 0 &&
        !a.creditLimit &&
        a.currencyCode === (CURRENCY.UAH as number),
    )
    .reduce((sum, a) => sum + a.balance / 100, 0);
  const debt = accounts
    .filter((a) => isMonoDebt(a))
    .reduce((sum, a) => sum + getMonoDebt(a), 0);
  return { balance, debt };
}
