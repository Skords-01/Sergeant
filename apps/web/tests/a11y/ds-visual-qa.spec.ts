import { test, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Design-system visual QA — captures 30 full-page screenshots covering
 * 3 widths × 2 themes × 5 hub surfaces, per the handoff §5 deliverable.
 *
 * Output: `.agents/ds-qa/<theme>/<width>/<surface>.png`
 *
 * Not part of regular CI — runs explicitly via `npm run test:a11y -- \
 * tests/a11y/ds-visual-qa.spec.ts`.
 */

const OUT_DIR = path.resolve(__dirname, "../../.agents/ds-qa");

const WIDTHS = [375, 414, 768] as const;
const THEMES = ["light", "dark"] as const;

const SURFACES: Array<{ name: string; path: string }> = [
  { name: "1-hub", path: "/" },
  { name: "2-finyk", path: "/?module=finyk" },
  { name: "3-fizruk", path: "/?module=fizruk" },
  { name: "4-routine", path: "/?module=routine" },
  { name: "5-nutrition", path: "/?module=nutrition" },
];

function buildSeed(theme: "light" | "dark"): Record<string, string> {
  return {
    hub_onboarding_done_v1: "1",
    hub_first_action_done_v1: "1",
    finyk_manual_only_v1: "1",
    hub_dark_mode_v1: theme === "dark" ? "1" : "0",
    hub_vibe_picks_v1: JSON.stringify({
      picks: ["finyk", "fizruk", "nutrition", "routine"],
      firstActionPending: null,
      firstActionStartedAt: null,
      firstRealEntryAt: Date.now(),
      updatedAt: Date.now(),
    }),
  };
}

async function seedLocalStorage(page: Page, theme: "light" | "dark") {
  await page.addInitScript((entries: Record<string, string>) => {
    try {
      for (const [k, v] of Object.entries(entries)) {
        window.localStorage.setItem(k, v);
      }
    } catch {
      /* ignore */
    }
  }, buildSeed(theme));
}

for (const theme of THEMES) {
  for (const width of WIDTHS) {
    test(`ds-qa: ${theme} @ ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await seedLocalStorage(page, theme);

      for (const { name, path: routePath } of SURFACES) {
        await page.goto(routePath, { waitUntil: "domcontentloaded" });
        // Settle dynamic imports + charts
        await page
          .waitForLoadState("networkidle", { timeout: 15_000 })
          .catch(() => {
            /* some surfaces keep long-polling — OK */
          });
        await page
          .locator("main, #root > *")
          .first()
          .waitFor({ state: "visible", timeout: 10_000 });
        // Extra settle for Recharts ResponsiveContainer + lazy chunks
        await page.waitForTimeout(800);

        const outFile = path.join(OUT_DIR, theme, String(width), `${name}.png`);
        fs.mkdirSync(path.dirname(outFile), { recursive: true });
        await page.screenshot({
          path: outFile,
          fullPage: true,
          animations: "disabled",
        });
      }
    });
  }
}
