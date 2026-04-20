const CURRENCY = new Intl.NumberFormat("uk-UA", {
  style: "decimal",
  maximumFractionDigits: 0,
});

export function fmtUah(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${CURRENCY.format(Math.round(v))} грн`;
}

export function fmtNum(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return CURRENCY.format(Math.round(v));
}
