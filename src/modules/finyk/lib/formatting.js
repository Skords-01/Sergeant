import { CURRENCY } from "../constants";

export function fmtAmt(amount, cc = CURRENCY.UAH) {
  const v = amount / 100;
  const sym = cc === CURRENCY.UAH ? "₴" : cc === CURRENCY.USD ? "$" : "€";
  return `${v > 0 ? "+" : ""}${v.toLocaleString("uk-UA", { minimumFractionDigits: 2 })}${sym}`;
}

export function fmtDate(ts) {
  const d = new Date(ts * 1000);
  // Compare by calendar day at midnight, not elapsed milliseconds, so a
  // transaction at 23:50 and a read at 00:10 render as "Вчора", not "Сьогодні".
  const d0 = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today - d0) / 86400000);
  const t = d.toLocaleTimeString("uk-UA", {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (diff === 0) return `Сьогодні, ${t}`;
  if (diff === 1) return `Вчора, ${t}`;
  return d.toLocaleDateString("uk-UA", { day: "2-digit", month: "short" });
}

export function getAccountLabel(acc) {
  if (acc.type === "eAid") return "💳 Єпідтримка";
  if (acc.creditLimit > 0 && acc.type === "black") return "🖤 Кредитна картка";
  if (acc.creditLimit > 0) return "💳 Кредит";
  if (acc.type === "black") return "🖤 Чорна картка";
  if (acc.type === "white") return "⬜ Біла картка";
  if (acc.type === "platinum") return "💎 Платинова";
  if (acc.type === "iron") return "🔩 Залізна";
  if (acc.type === "fop") return "🏢 ФОП";
  return "💳 Картка";
}
