/**
 * Finyk — Transactions period filter.
 *
 * Second Detox E2E suite for the mobile app, paired with the growing
 * testID scheme documented in `apps/mobile/e2e/README.md` (see the
 * migration plan §8 + §13 Q8). Covers the period-filter vertical
 * slice that the first suite (`finyk-manual-expense.e2e.ts`) did not
 * exercise:
 *
 *   1. Seed a current-month manual expense via the same add-sheet flow
 *      the first suite uses — this gives the feed a deterministic
 *      row regardless of MMKV state left behind by other suites.
 *   2. Assert the new `finyk-tx-row-*` is visible in the day-grouped
 *      list (presence).
 *   3. Tap the `finyk-transactions-prev-month` chevron → the list
 *      scopes to the previous month, where no expenses have been
 *      seeded → assert zero `finyk-tx-row-*` nodes (absence).
 *   4. Tap `finyk-transactions-next-month` → returns to the current
 *      month → assert the seeded row is visible again.
 *
 * Matches the testID scheme documented in
 * `apps/mobile/e2e/README.md`: we match by `testID` only — never by
 * formatted date / amount text, because locale affects both.
 */
import { by, element, expect as detoxExpect, waitFor } from "detox";

import {
  DEFAULT_WAIT_MS,
  byId,
  tapWhenVisible,
  waitForVisibleById,
} from "./helpers";

const EXPENSE_AMOUNT = "42.10";

describe("Фінік — Transactions period filter", () => {
  it("filters the feed to the active month when using prev/next chevrons", async () => {
    // 1. Navigate Finyk → Transactions.
    await tapWhenVisible("tab-finyk");
    await waitForVisibleById("finyk-overview-scroll");
    await tapWhenVisible("finyk-overview-nav-transactions");
    await waitForVisibleById("finyk-transactions");

    // 2. Seed one current-month expense so the test doesn't depend on
    //    any prior suite's residual MMKV state. We reuse the exact
    //    same add-sheet flow as `finyk-manual-expense.e2e.ts`.
    await tapWhenVisible("finyk-transactions-add");
    await waitForVisibleById("finyk-transactions-sheet");
    await byId("finyk-transactions-sheet-amount").typeText(EXPENSE_AMOUNT);
    await waitFor(element(by.id(/^finyk-transactions-sheet-category-/)))
      .toBeVisible()
      .withTimeout(DEFAULT_WAIT_MS);
    await element(by.id(/^finyk-transactions-sheet-category-/))
      .atIndex(0)
      .tap();
    await tapWhenVisible("finyk-transactions-sheet-submit");
    await waitFor(element(by.id("finyk-transactions-sheet")))
      .not.toBeVisible()
      .withTimeout(DEFAULT_WAIT_MS);

    // 3. Presence — the newly-seeded row should be in the feed.
    await waitFor(element(by.id(/^finyk-tx-row-/)))
      .toBeVisible()
      .withTimeout(DEFAULT_WAIT_MS);
    await detoxExpect(
      element(by.id(/^finyk-tx-row-/)).atIndex(0),
    ).toBeVisible();

    // 4. Tap prev-month chevron. No prior suite seeds *previous*
    //    month data, so the feed collapses to the empty state and
    //    every `finyk-tx-row-*` disappears from the screen. We pin
    //    this with `toNotExist()` against the regex matcher so the
    //    assertion fails if any stale row is still mounted.
    await tapWhenVisible("finyk-transactions-prev-month");
    await waitFor(element(by.id(/^finyk-tx-row-/)))
      .toNotExist()
      .withTimeout(DEFAULT_WAIT_MS);

    // 5. Next-month returns us to the current month and the seeded
    //    row must be back on screen. `reloadReactNative()` runs
    //    between `it()` blocks, but not between assertions inside a
    //    single `it()` — so the MMKV-backed row is still there.
    await tapWhenVisible("finyk-transactions-next-month");
    await waitFor(element(by.id(/^finyk-tx-row-/)))
      .toBeVisible()
      .withTimeout(DEFAULT_WAIT_MS);
    await detoxExpect(
      element(by.id(/^finyk-tx-row-/)).atIndex(0),
    ).toBeVisible();
  });
});
