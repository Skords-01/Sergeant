export function normalizeFoodName(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[•·]/g, ",")
    .replace(/^[,;]+|[,;]+$/g, "");
}

export function normalizeUnit(u) {
  const s = String(u || "")
    .trim()
    .toLowerCase()
    .replace(/\./g, "");
  if (!s) return null;
  if (["г", "гр", "грам", "грами"].includes(s)) return "г";
  if (["кг", "кілограм", "кілограми"].includes(s)) return "кг";
  if (["мл", "мілілітр", "мілілітри"].includes(s)) return "мл";
  if (["л", "літр", "літри"].includes(s)) return "л";
  if (["шт", "штук", "штуки"].includes(s)) return "шт";
  if (["уп", "упак", "упаковка", "пач", "пачка", "пак", "пакет"].includes(s))
    return "уп";
  return s;
}

export function parseLoosePantryText(raw) {
  const parts = String(raw || "")
    .replace(/\n+/g, ",")
    .split(/[;,]/g)
    .map((s) => s.trim())
    .filter(Boolean);

  return parts
    .map((p) => {
      // e.g. "2 яйця", "200 г курка", "0.5л молоко"
      const m = p.match(
        /^(\d+(?:[.,]\d+)?)\s*([a-zA-Zа-яА-ЯіїєґІЇЄҐ%]+)?\s*(.+)?$/,
      );
      if (!m)
        return {
          name: normalizeFoodName(p),
          qty: null,
          unit: null,
          notes: null,
        };
      const qty = m[1] ? Number(String(m[1]).replace(",", ".")) : null;
      const unitRaw = normalizeFoodName(m[2] || "");
      const rest = normalizeFoodName(m[3] || "");

      // Якщо після числа йде лише одне слово (без решти), це зазвичай назва продукту,
      // а не "одиниця виміру" (напр. "2 яйця" -> name="яйця", qty=2, unit="шт").
      if (!rest && unitRaw) {
        return {
          name: normalizeFoodName(unitRaw),
          qty: Number.isFinite(qty) ? qty : null,
          unit: Number.isFinite(qty) ? "шт" : null,
          notes: null,
        };
      }

      const name =
        rest ||
        normalizeFoodName(p.replace(m[0], "").trim()) ||
        normalizeFoodName(p);
      const unit = unitRaw ? normalizeUnit(unitRaw) : null;
      const resolvedQty = Number.isFinite(qty) ? qty : null;
      return {
        name: normalizeFoodName(name),
        qty: resolvedQty,
        unit: resolvedQty != null && unit == null ? "шт" : unit,
        notes: null,
      };
    })
    .filter((x) => x.name);
}
