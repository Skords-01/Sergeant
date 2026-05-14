/**
 * Cold-start HeroPromiseCard copy table (PR-09, S5 outcome-card).
 *
 * Replaces the pre-PR-09 cold-start scaffold (`<OnboardingProgress />`
 * — «2/4 розділів готові») with a per-module promise of the value the
 * user is *buying* by recording the first real entry. The promise
 * lives in a shared lookup table so the routing-prone "we ship copy
 * via TSX" pattern can be guarded with the same audit-tests as the
 * post-first-entry CelebrationModal copy in `onboardingCelebrations`.
 *
 * Surface contract (master tracker §5.2 / §5.3):
 *   • headline — one short outcome promise per primary module
 *   • body     — concrete next step that produces the promise
 *   • cta      — imperative CTA label that routes into the module's
 *                first-action sheet (the actual routing is owned by
 *                the consumer — see `HeroPromiseCard` in apps/web)
 *
 * Audit-guards (see `heroPromise.test.ts`):
 *   • distinctness across modules (no copy collapse)
 *   • no «X/Y розділів» / «N з N» activation-bar regressions
 *   • CTA labels are imperative + ≤ 30 chars (no «Продовжити» fallback)
 *
 * This file is consumed by:
 *   • `apps/web/src/core/hub/HeroPromiseCard.tsx` (web cold-start)
 *   • mobile parity is **deferred** to PR-21 (wave 4 mobile FTUX
 *     sweep) — the table here is platform-agnostic so the parity
 *     PR only adds a render-shell.
 */
import type { DashboardModuleId } from "./dashboard";
import { DASHBOARD_MODULE_IDS } from "./dashboard";

/**
 * Action verb shipped alongside the CTA label. Consumers map the verb
 * to whatever module-native sheet exists today (`add_expense`,
 * `start_workout`, `add_habit`, `add_meal`) — kept as a string union
 * here to avoid pulling apps/web's `HubModuleAction` into shared.
 */
export type HeroPromiseAction =
  | "add_expense"
  | "start_workout"
  | "add_habit"
  | "add_meal";

export interface HeroPromiseCopy {
  /** Outcome promise headline. ≤ 32 Cyrillic chars. Outcome-first
   *  framing — never feature-first («Sergeant — твій хаб» etc). */
  headline: string;
  /** Concrete next-step body. ≤ 110 chars so it fits on phones
   *  without truncation. Must describe the *mechanic that produces
   *  the promise*, not yet another TODO. */
  body: string;
  /** Imperative CTA label. ≤ 30 chars, no trailing punctuation. */
  ctaLabel: string;
  /** Action verb the CTA routes to (consumer maps to module-native
   *  action sheet). */
  ctaAction: HeroPromiseAction;
}

/**
 * Per-module promise copy. Numbers (2-3 витрати, 30 днів, тощо) are
 * deliberately concrete — abstract «декілька днів» language tested
 * worse in the 2026-05-03 roast B-11 §2.9 audit-trail.
 */
export const HERO_PROMISE: Record<DashboardModuleId, HeroPromiseCopy> = {
  finyk: {
    headline: "Твоя зарплата на радарі",
    body: "Додай суму витрати — і побачиш, скільки лишилося до зарплати.",
    ctaLabel: "Записати першу витрату",
    ctaAction: "add_expense",
  },
  fizruk: {
    headline: "Сили вистачить — якщо рахуємо",
    body: "Признач 1 тренування — у п'ятницю побачимо, що зробив за тиждень.",
    ctaLabel: "Запланувати тренування",
    ctaAction: "start_workout",
  },
  routine: {
    headline: "Твій тиждень тут",
    body: "Обери звичку — виконай завтра — стрік запалився за два дні підряд.",
    ctaLabel: "Створити звичку зараз",
    ctaAction: "add_habit",
  },
  nutrition: {
    headline: "Що з'їв сьогодні?",
    body: "Скани штрих-код — і за тиждень побачиш свій pattern по БЖВ.",
    ctaLabel: "Додати прийом їжі",
    ctaAction: "add_meal",
  },
};

/**
 * Look up promise copy for a primary module. Returns `null` when the
 * cold-start state has no primary module (user has no `vibePicks`,
 * which short-circuits the whole HeroPromiseCard render upstream).
 */
export function getHeroPromiseCopy(
  moduleId: DashboardModuleId | null | undefined,
): HeroPromiseCopy | null {
  if (!moduleId) return null;
  return HERO_PROMISE[moduleId];
}

/**
 * Convenience: every known module id with copy. Kept as a typed
 * iterable so `Object.keys(HERO_PROMISE)` (which returns `string[]`)
 * never bleeds through to consumers.
 */
export const HERO_PROMISE_MODULE_IDS: readonly DashboardModuleId[] =
  DASHBOARD_MODULE_IDS;
