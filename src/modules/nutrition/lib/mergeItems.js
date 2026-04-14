import { normalizeFoodName, normalizeUnit } from "./pantryTextParser.js";

function toBaseUnit(qty, unit) {
  const u = String(unit || "").toLowerCase();
  const q = Number(qty);
  if (!Number.isFinite(q)) return null;
  if (u === "г") return { base: "г", value: q };
  if (u === "кг") return { base: "г", value: q * 1000 };
  if (u === "мл") return { base: "мл", value: q };
  if (u === "л") return { base: "мл", value: q * 1000 };
  if (u === "шт") return { base: "шт", value: q };
  return null;
}

function roundNice(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return n;
  // 1 знак після коми для невеликих дробів, інакше ціле
  if (Math.abs(x) < 10 && Math.round(x) !== x) return Math.round(x * 10) / 10;
  return Math.round(x);
}

export function mergeItems(oldItems, newItems) {
  const a = Array.isArray(oldItems) ? oldItems : [];
  const b = Array.isArray(newItems) ? newItems : [];
  const merged = [...a];

  for (const it of b) {
    const n = normalizeFoodName(it?.name);
    if (!n) continue;

    const incomingQty =
      it?.qty != null && it.qty !== "" && Number.isFinite(Number(it.qty))
        ? Number(it.qty)
        : null;
    const incomingUnit = it?.unit ? normalizeUnit(it.unit) : null;

    // Гібрид: сумуємо лише якщо є qty+unit і одиниці сумісні (або однакові)
    if (incomingQty != null && incomingUnit) {
      const baseIncoming = toBaseUnit(incomingQty, incomingUnit);
      if (baseIncoming) {
        const idx = merged.findIndex((x) => {
          const nx = normalizeFoodName(x?.name);
          if (nx !== n) return false;
          const qx =
            x?.qty != null && x.qty !== "" && Number.isFinite(Number(x.qty))
              ? Number(x.qty)
              : null;
          const ux = x?.unit ? normalizeUnit(x.unit) : null;
          if (qx == null || !ux) return false;
          const baseX = toBaseUnit(qx, ux);
          return !!baseX && baseX.base === baseIncoming.base;
        });

        if (idx >= 0) {
          const cur = merged[idx];
          const qx = Number(cur.qty);
          const ux = normalizeUnit(cur.unit);
          const baseX = toBaseUnit(qx, ux);
          merged[idx] = {
            ...cur,
            qty: roundNice(baseX.value + baseIncoming.value),
            unit: baseIncoming.base,
          };
          continue;
        }
      }
    }

    // Якщо не сумуємо — додаємо як окрему позицію, але уникаємо точного дубля (name+unit+qty)
    const fingerprint = `${n}__${incomingUnit || ""}__${incomingQty ?? ""}`;
    const exists = merged.some((x) => {
      const nx = normalizeFoodName(x?.name);
      const qx = x?.qty != null && x.qty !== "" ? Number(x.qty) : null;
      const ux = x?.unit ? normalizeUnit(x.unit) : null;
      const fp = `${nx}__${ux || ""}__${qx ?? ""}`;
      return fp === fingerprint;
    });
    if (exists) continue;
    merged.push({
      name: n,
      qty: incomingQty,
      unit: incomingUnit,
      notes: it?.notes ?? null,
    });
  }

  return merged;
}

