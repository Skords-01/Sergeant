import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Pre-seed localStorage so the SPA skips the onboarding redirect
 * (`/welcome`) and lands directly on the targeted hub surface. The
 * keys mirror the ones used in `src/core/OnboardingWizard.tsx` and
 * `src/core/onboarding/vibePicks.js`.
 */
const SEEDED_LS: Record<string, string> = {
  hub_onboarding_done_v1: "1",
  hub_first_action_done_v1: "1",
  // Minimal vibe-picks payload so `isFirstRealEntryDone()` returns true
  // without requiring real fixture entries in the four module stores.
  hub_vibe_picks_v1: JSON.stringify({
    picks: ["finyk", "fizruk", "nutrition", "routine"],
    firstActionPending: null,
    firstActionStartedAt: null,
    firstRealEntryAt: Date.now(),
    updatedAt: Date.now(),
  }),
};

async function seedLocalStorage(page: Page) {
  await page.addInitScript((entries: Record<string, string>) => {
    try {
      for (const [k, v] of Object.entries(entries)) {
        window.localStorage.setItem(k, v);
      }
    } catch {
      /* ignore */
    }
  }, SEEDED_LS);
}

/**
 * Four surfaces we care about per the design-system handoff:
 * Hub / Finyk overview / Fizruk progress / Nutrition dashboard.
 * Routine is included as well since it shares the same hub shell and
 * accessibility is no less relevant there.
 */
const SURFACES: Array<{ name: string; path: string }> = [
  { name: "hub-root", path: "/" },
  { name: "finyk-overview", path: "/?module=finyk" },
  { name: "fizruk-dashboard", path: "/?module=fizruk" },
  { name: "nutrition-dashboard", path: "/?module=nutrition" },
  { name: "routine-dashboard", path: "/?module=routine" },
];

for (const { name, path } of SURFACES) {
  test(`a11y: ${name} has no serious/critical violations`, async ({ page }) => {
    await seedLocalStorage(page);

    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(path, { waitUntil: "domcontentloaded" });
    // Modules are lazy-loaded via React.lazy — wait for either the
    // hub tabs or the module shell to settle before axe takes its
    // snapshot.
    await page
      .waitForLoadState("networkidle", { timeout: 15_000 })
      .catch(() => {
        /* allow-through: some surfaces keep long-polling connections open */
      });
    // Give the Suspense fallback (PageLoader) time to resolve into the
    // real UI. Playwright's default 30s test timeout protects us from
    // hangs; here we just ask for the first interactive element.
    await page
      .locator("main, [role='main'], [data-a11y-root], #root > *")
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    const results = await new AxeBuilder({ page })
      // Standard WCAG 2.1 AA rule set + best-practices. We scope to the
      // document root; route-level portals (toasts, chat overlay) are
      // included naturally because they render under `#root`.
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
      .analyze();

    const blocking = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );

    if (blocking.length > 0) {
      const summary = blocking
        .map(
          (v) =>
            `- [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node${
              v.nodes.length === 1 ? "" : "s"
            })\n    ${v.helpUrl}`,
        )
        .join("\n");
      throw new Error(
        `axe found ${blocking.length} serious/critical violation(s) on ${path}:\n${summary}`,
      );
    }

    // Soft-signal: surface non-blocking violations in the report so PR
    // reviewers have visibility into the full axe output.
    const softCount = results.violations.length - blocking.length;
    if (softCount > 0) {
      test.info().annotations.push({
        type: "axe-soft",
        description: `${softCount} non-blocking violation(s) on ${path} (minor/moderate).`,
      });
    }

    // Sanity: SPA bootstrap should not print console errors on these
    // top-level surfaces in a fresh profile.
    expect(
      consoleErrors.filter(
        (e) =>
          // vite-plugin-pwa registerSW noise in preview mode.
          !e.includes("workbox") && !e.includes("Service worker"),
      ),
      `console errors on ${path}:\n${consoleErrors.join("\n")}`,
    ).toEqual([]);
  });
}
