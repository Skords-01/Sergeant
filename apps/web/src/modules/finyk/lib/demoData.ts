// Manual-only flag helpers for Finyk.
//
// Historically this file also hosted the FTUX demo-seeding path; that
// has been removed (empty-state first-run). What remains is the flag
// that lets FinykApp skip the Monobank login gate — used by the
// onboarding presets and by the "Далі без банку" escape hatch on the
// Finyk login screen itself.
//
// Kept at this path (rather than renamed) so the many call sites that
// already import `FINYK_MANUAL_ONLY_KEY` / `enableFinykManualOnly` from
// here don't need to be touched.

import { writeRaw } from "./finykStorage.js";

/**
 * localStorage flag that lets Finyk render its full UI even without a
 * Monobank token. Set by either the onboarding first-action flow or
 * the "Далі без банку" button on the login screen.
 */
export const FINYK_MANUAL_ONLY_KEY = "finyk_manual_only_v1";

/**
 * Mark the account as "manual only" — Finyk will skip the Monobank
 * login screen. Used by the onboarding "Додати першу витрату" path
 * and by the "Далі без банку" button on the login screen itself.
 */
export function enableFinykManualOnly(): void {
  try {
    writeRaw(FINYK_MANUAL_ONLY_KEY, "1");
  } catch {
    /* noop */
  }
}
