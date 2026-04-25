export function formatDate(value: string | Date): string {
  try {
    const d = typeof value === "string" ? new Date(value) : value;
    return d.toLocaleString("uk-UA", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(value);
  }
}

export function parseUA(ua: string | null | undefined): string {
  if (!ua) return "Невідомий пристрій";
  const browser =
    ua.match(/(?:Chrome|Firefox|Safari|Edge|Opera|OPR)[/ ]([\d.]+)/)?.[0] ?? "";
  const os =
    ua.match(
      /(?:Windows NT [\d.]+|Mac OS X [\d._]+|Linux|Android [\d.]+|iOS [\d._]+)/,
    )?.[0] ?? "";
  const parts = [browser, os].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : "Невідомий пристрій";
}
