export interface PantryItem {
  name: string;
  qty: number | null;
  unit: string | null;
  notes: string | null;
}

export function normalizeFoodName(s: unknown): string {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[•·]/g, ",")
    .replace(/^[,;]+|[,;]+$/g, "");
}

export function normalizeUnit(u: unknown): string | null {
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

// Мапа типових форм → канонічна форма продукту.
// Використовується лише для зіставлення при злитті; відображуване ім'я
// не змінюється.
const FOOD_ALIASES = new Map<string, string>([
  // овочі
  ["огірки", "огірок"],
  ["огірків", "огірок"],
  ["огірка", "огірок"],
  ["огіркі", "огірок"],
  ["помідори", "помідор"],
  ["помідорів", "помідор"],
  ["помідора", "помідор"],
  ["томат", "помідор"],
  ["томати", "помідор"],
  ["томатів", "помідор"],
  ["моркви", "морква"],
  ["моркву", "морква"],
  ["морквина", "морква"],
  ["морквини", "морква"],
  ["цибулі", "цибуля"],
  ["цибулю", "цибуля"],
  ["цибулин", "цибуля"],
  ["цибулина", "цибуля"],
  ["часнику", "часник"],
  ["картоплі", "картопля"],
  ["картоплю", "картопля"],
  ["капусти", "капуста"],
  ["капусту", "капуста"],
  ["перцю", "перець"],
  ["перці", "перець"],
  ["перців", "перець"],
  ["буряку", "буряк"],
  ["буряка", "буряк"],
  ["буряки", "буряк"],
  ["кабачки", "кабачок"],
  ["кабачків", "кабачок"],
  ["баклажани", "баклажан"],
  ["баклажанів", "баклажан"],
  ["броколі", "броколі"],

  // фрукти / ягоди
  ["яблука", "яблуко"],
  ["яблук", "яблуко"],
  ["груші", "груша"],
  ["груш", "груша"],
  ["банани", "банан"],
  ["бананів", "банан"],
  ["банана", "банан"],
  ["апельсини", "апельсин"],
  ["апельсинів", "апельсин"],
  ["мандарини", "мандарин"],
  ["мандаринів", "мандарин"],
  ["лимони", "лимон"],
  ["лимонів", "лимон"],
  ["ківі", "ківі"],
  ["виноград", "виноград"],
  ["полуниці", "полуниця"],
  ["полуницю", "полуниця"],
  ["чорниці", "чорниця"],
  ["малини", "малина"],

  // мʼясо / риба
  ["курки", "курка"],
  ["курку", "курка"],
  ["курячого", "курка"],
  ["курячі", "курка"],
  ["філе курки", "курка"],
  ["індичка", "індичка"],
  ["індички", "індичка"],
  ["свинини", "свинина"],
  ["свинину", "свинина"],
  ["яловичини", "яловичина"],
  ["яловичину", "яловичина"],
  ["фаршу", "фарш"],
  ["лосося", "лосось"],
  ["лососі", "лосось"],
  ["форелі", "форель"],
  ["тунця", "тунець"],
  ["тунцю", "тунець"],
  ["креветки", "креветка"],
  ["креветок", "креветка"],

  // молочні / яйця
  ["яйця", "яйце"],
  ["яєць", "яйце"],
  ["яєчко", "яйце"],
  ["молока", "молоко"],
  ["кефіру", "кефір"],
  ["сметани", "сметана"],
  ["сметану", "сметана"],
  ["йогурту", "йогурт"],
  ["йогурти", "йогурт"],
  ["сири", "сир"],
  ["сиру", "сир"],
  ["творогу", "творог"],
  ["масла", "масло"],
  ["вершків", "вершки"],
  ["ряжанки", "ряжанка"],

  // крупи / хліб / мука
  ["рису", "рис"],
  ["гречки", "гречка"],
  ["вівсянки", "вівсянка"],
  ["вівсянку", "вівсянка"],
  ["вівсяні пластівці", "вівсянка"],
  ["вівса", "овес"],
  ["пшона", "пшоно"],
  ["манки", "манка"],
  ["макаронів", "макарони"],
  ["макарон", "макарони"],
  ["спагетті", "спагеті"],
  ["хліба", "хліб"],
  ["булочки", "булочка"],
  ["лаваша", "лаваш"],
  ["борошна", "борошно"],
  ["муки", "борошно"],
  ["мука", "борошно"],
  ["киноа", "кіноа"],
  ["булгуру", "булгур"],

  // олії / спеції
  ["олії", "олія"],
  ["олію", "олія"],
  ["оливкової олії", "оливкова олія"],
  ["солі", "сіль"],
  ["цукру", "цукор"],
  ["меду", "мед"],
]);

// Канонічний ключ продукту для порівняння при злитті.
export function canonicalFoodKey(name: unknown): string {
  const n = normalizeFoodName(name);
  if (!n) return "";
  const alias = FOOD_ALIASES.get(n);
  if (alias) return alias;

  // Легкий стемінг для окремих слів: відрізаємо типові укр. закінчення
  // множини/родового відмінка, якщо після них залишається ≥4 літер.
  if (!n.includes(" ")) {
    const stems = [/ів$/, /ами$/, /ями$/, /ах$/, /ям$/];
    for (const re of stems) {
      if (re.test(n)) {
        const stem = n.replace(re, "");
        if (stem.length >= 4) return stem;
      }
    }
  }
  return n;
}

const UNIT_CHAR_RE = "[a-zA-Zа-яА-ЯіїєґІЇЄҐ%]+";
const LEADING_QTY_RE = new RegExp(
  `^(\\d+(?:[.,]\\d+)?)\\s*(${UNIT_CHAR_RE})?\\s*(.+)?$`,
);
const TRAILING_QTY_RE = new RegExp(
  `^(.+?)\\s+(\\d+(?:[.,]\\d+)?)\\s*(${UNIT_CHAR_RE})?$`,
);

function buildLeadingResult(m: RegExpMatchArray, raw: string): PantryItem {
  const qty = m[1] ? Number(String(m[1]).replace(",", ".")) : null;
  const unitRaw = normalizeFoodName(m[2] || "");
  const rest = normalizeFoodName(m[3] || "");

  // "2 яйця" — одне слово після числа = назва, не одиниця
  if (!rest && unitRaw) {
    return {
      name: normalizeFoodName(unitRaw),
      qty: qty != null && Number.isFinite(qty) ? qty : null,
      unit: qty != null && Number.isFinite(qty) ? "шт" : null,
      notes: null,
    };
  }

  const name =
    rest ||
    normalizeFoodName(raw.replace(m[0], "").trim()) ||
    normalizeFoodName(raw);
  const unit = unitRaw ? normalizeUnit(unitRaw) : null;
  const resolvedQty = qty != null && Number.isFinite(qty) ? qty : null;
  return {
    name: normalizeFoodName(name),
    qty: resolvedQty,
    unit: resolvedQty != null && unit == null ? "шт" : unit,
    notes: null,
  };
}

function buildTrailingResult(tm: RegExpMatchArray): PantryItem | null {
  const name = normalizeFoodName(tm[1]);
  if (!name) return null;
  const qty = Number(String(tm[2]).replace(",", "."));
  const unitRaw = normalizeFoodName(tm[3] || "");
  const unit = unitRaw ? normalizeUnit(unitRaw) : null;
  const resolvedQty = Number.isFinite(qty) ? qty : null;
  return {
    name,
    qty: resolvedQty,
    unit: resolvedQty != null && unit == null ? "шт" : unit,
    notes: null,
  };
}

export function parseLoosePantryText(raw: unknown): PantryItem[] {
  const parts = String(raw || "")
    .replace(/\n+/g, ",")
    .split(/[;,]/g)
    .map((s) => s.trim())
    .filter(Boolean);

  return parts
    .map<PantryItem>((p) => {
      // кількість спереду: "2 яйця", "200 г курка", "0.5л молоко"
      const m = p.match(LEADING_QTY_RE);
      if (m) return buildLeadingResult(m, p);

      // кількість в кінці: "огірки 4", "яйця 3 шт"
      const tm = p.match(TRAILING_QTY_RE);
      if (tm) {
        const res = buildTrailingResult(tm);
        if (res) return res;
      }

      return {
        name: normalizeFoodName(p),
        qty: null,
        unit: null,
        notes: null,
      };
    })
    .filter((x) => x.name);
}
