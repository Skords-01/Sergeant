/**
 * Матчінг рядків для глобального пошуку. Колись жив інлайном у
 * `HubSearch.tsx` і зводився до `String.includes`. Тепер:
 *
 *  1) Нормалізуємо (lowercase + NFD + видалення діакритики + заміна
 *     апострофів — щоб "їдальня" знаходилась за "ідальня" / "idalnya"
 *     не претендуємо, але "м'ясо" ↔ "мясо" ↔ "м`ясо" матчиться).
 *  2) Токенуємо запит по пробілах і вимагаємо, щоб кожен токен
 *     з'являвся у title/subtitle як підрядок (AND між токенами).
 *     Це fuzzy-ish без ваги Levenshtein — дешево й стабільно на
 *     десятках тисяч транзакцій.
 *  3) Рахуємо простий skor (prefix match > substring, match у title >
 *     match у subtitle) щоб сортувати результати в межах групи.
 */

export function normalize(s: string): string {
  if (!s) return "";
  try {
    return s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[\u2018\u2019\u02bc'`´]/g, "");
  } catch {
    return s.toLowerCase();
  }
}

export function tokenize(q: string): string[] {
  return normalize(q)
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

export interface Scorable {
  title?: string;
  subtitle?: string;
}

/**
 * Повертає score >= 0 якщо збіг, або -1 якщо не збіг. Усі токени
 * запиту мають зустрітися у title/subtitle.
 */
export function scoreMatch(item: Scorable, tokens: string[]): number {
  if (tokens.length === 0) return 0;
  const title = normalize(item.title || "");
  const subtitle = normalize(item.subtitle || "");
  const hay = `${title} ${subtitle}`;

  let score = 0;
  for (const t of tokens) {
    if (!hay.includes(t)) return -1;
    // Prefix у title — топ; просто subtitle — менше.
    if (title.startsWith(t)) score += 12;
    else if (title.includes(t)) score += 6;
    else if (subtitle.includes(t)) score += 2;
    // Бонус за довгий збіг (щоб "хліб" бив над "хлібом" без префіксу).
    score += Math.min(4, t.length);
  }
  return score;
}

/** Фільтр + сортування за score. Зберігає стабільний порядок для рівних scores. */
export function scoreAndSort<T extends Scorable>(
  items: T[],
  query: string,
  limit = 10,
): T[] {
  const tokens = tokenize(query);
  if (!tokens.length) return items.slice(0, limit);
  const scored: Array<{ item: T; score: number; idx: number }> = [];
  items.forEach((item, idx) => {
    const s = scoreMatch(item, tokens);
    if (s >= 0) scored.push({ item, score: s, idx });
  });
  scored.sort((a, b) => b.score - a.score || a.idx - b.idx);
  return scored.slice(0, limit).map((e) => e.item);
}

/** Локальне сховище для недавніх запитів. Кап на 5 — щоб UI лишався легким. */
const RECENTS_KEY = "hub_search_recents_v1";
const RECENTS_CAP = 5;

export function getRecentQueries(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((v) => typeof v === "string").slice(0, RECENTS_CAP);
  } catch {
    return [];
  }
}

export function pushRecentQuery(q: string): string[] {
  const norm = q.trim();
  if (!norm) return getRecentQueries();
  try {
    const current = getRecentQueries();
    const next = [norm, ...current.filter((v) => v !== norm)].slice(
      0,
      RECENTS_CAP,
    );
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
    return next;
  } catch {
    return getRecentQueries();
  }
}

export function clearRecentQueries(): void {
  try {
    localStorage.removeItem(RECENTS_KEY);
  } catch {
    /* noop */
  }
}
