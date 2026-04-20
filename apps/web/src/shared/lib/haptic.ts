/**
 * Тонкий шар над `navigator.vibrate`, який:
 *  1) вимикається, коли користувач ввімкнув `prefers-reduced-motion`;
 *  2) тихо робить no-op на платформах без підтримки (iOS Safari, настільні);
 *  3) ловить винятки, бо деякі мобільні Chrome кидають `NotAllowedError`,
 *     якщо викликати `vibrate` поза user-gesture.
 *
 * Патерни вибрані так, щоб співпасти з фізичним очікуванням від дії:
 *  - `tap`      — легкий тап (10 мс), primary CTA, toggle, tab change;
 *  - `success`  — подвійний короткий (12/40/18), успішне збереження;
 *  - `warning`  — 30 мс, destructive confirm;
 *  - `error`    — 60/60/60, помилка мережі / валідації.
 *
 * Використовуй `hapticPattern` напряму для особливих сценаріїв (наприклад,
 * фінішер тренування вже вібрує [200, 100, 200] у Fizruk — цей модуль
 * не знижує його "силу").
 */

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function canVibrate(): boolean {
  if (typeof navigator === "undefined") return false;
  return typeof navigator.vibrate === "function";
}

export function hapticPattern(pattern: number | number[]): void {
  if (!canVibrate() || prefersReducedMotion()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* noop — NotAllowedError / throttled by browser */
  }
}

/** Легкий tap — головні CTAs, toggles, tab switch. */
export function hapticTap(): void {
  hapticPattern(10);
}

/** Успішне збереження / завершення дії. */
export function hapticSuccess(): void {
  hapticPattern([12, 40, 18]);
}

/** Попередження / destructive confirm. */
export function hapticWarning(): void {
  hapticPattern(30);
}

/** Помилка (мережа, валідація, немає доступу). */
export function hapticError(): void {
  hapticPattern([60, 60, 60]);
}

/** Скасовує поточну вібрацію (наприклад, під час довгого натискання). */
export function hapticCancel(): void {
  if (!canVibrate()) return;
  try {
    navigator.vibrate(0);
  } catch {
    /* noop */
  }
}
