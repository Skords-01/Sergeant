// Demo seed for the Finyk onboarding "try with demo" path.
//
// Writes a small set of manual expenses directly into the existing storage
// key (`finyk_manual_expenses_v1`) so the Overview page has real numbers
// to show within a few seconds of opening the app — no bank connect, no
// typing. The seed is idempotent-ish: it will not overwrite user data if
// manual expenses already exist.

import { readJSON, writeJSON, writeRaw } from "./finykStorage.js";

/**
 * localStorage flag that lets Finyk render its full UI even without a
 * Monobank token. Set by either the onboarding "quick start" flow or the
 * "Далі без банку" button on the login screen.
 */
export const FINYK_MANUAL_ONLY_KEY = "finyk_manual_only_v1";

const MANUAL_EXPENSES_KEY = "finyk_manual_expenses_v1";

// Demo transactions — small, realistic amounts across the categories
// ManualExpenseSheet already exposes. Dates are written relative to "now"
// so the Overview "цього місяця" totals are always populated.
const DEMO_ENTRIES = [
  {
    offsetDays: 0,
    description: "Кава у Aroma Kava",
    amount: 95,
    category: "їжа",
  },
  {
    offsetDays: 1,
    description: "Uber додому",
    amount: 180,
    category: "транспорт",
  },
  {
    offsetDays: 2,
    description: "Сільпо — продукти",
    amount: 640,
    category: "їжа",
  },
  {
    offsetDays: 4,
    description: "Кіно з друзями",
    amount: 350,
    category: "розваги",
  },
  {
    offsetDays: 7,
    description: "Аптека — вітаміни",
    amount: 420,
    category: "здоров'я",
  },
  {
    offsetDays: 10,
    description: "Spotify підписка",
    amount: 149,
    category: "розваги",
  },
  {
    offsetDays: 14,
    description: "Футболка Zara",
    amount: 890,
    category: "одяг",
  },
  {
    offsetDays: 21,
    description: "Комунальні послуги",
    amount: 1850,
    category: "комунальні",
  },
];

function todayAtNoon() {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
}

function demoEntry(base, offsetDays, payload) {
  const d = new Date(base.getTime() - offsetDays * 86400000);
  return {
    id: `demo-${d.getTime()}-${Math.round(payload.amount)}`,
    date: d.toISOString(),
    description: payload.description,
    amount: payload.amount,
    category: payload.category,
  };
}

/**
 * Seed demo manual expenses so the onboarding "Спробувати з демо" CTA has
 * something to render. Returns the number of entries actually inserted.
 *
 * - No-op (and returns 0) if the user already has manual expenses — we
 *   never want to trample real data.
 * - Also flips the manual-only flag so FinykApp skips the Monobank login
 *   gate for this user until they choose to connect a bank.
 */
export function seedFinykDemoData() {
  try {
    const existing = readJSON(MANUAL_EXPENSES_KEY, []);
    if (Array.isArray(existing) && existing.length > 0) {
      // User already has manual data — only flip the manual-only flag so
      // onboarding can still route them straight into the app.
      writeRaw(FINYK_MANUAL_ONLY_KEY, "1");
      return 0;
    }
    const base = todayAtNoon();
    const entries = DEMO_ENTRIES.map((e) => demoEntry(base, e.offsetDays, e));
    writeJSON(MANUAL_EXPENSES_KEY, entries);
    writeRaw(FINYK_MANUAL_ONLY_KEY, "1");
    return entries.length;
  } catch {
    return 0;
  }
}

/**
 * Mark the account as "manual only" — Finyk will skip the Monobank login
 * screen. Used by the onboarding "Додати першу витрату" path and by the
 * "Далі без банку" button on the login screen itself.
 */
export function enableFinykManualOnly() {
  try {
    writeRaw(FINYK_MANUAL_ONLY_KEY, "1");
  } catch {
    /* noop */
  }
}
