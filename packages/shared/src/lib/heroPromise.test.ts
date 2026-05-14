import { describe, it, expect } from "vitest";
import {
  HERO_PROMISE,
  HERO_PROMISE_MODULE_IDS,
  getHeroPromiseCopy,
} from "./heroPromise";
import { DASHBOARD_MODULE_IDS } from "./dashboard";

describe("heroPromise", () => {
  it("ships one entry per dashboard module (no orphan / missing copy)", () => {
    // Audit-guard: keep PR-09 shipping copy in lockstep with the
    // canonical module list. A new module added to
    // `DASHBOARD_MODULE_IDS` without a HERO_PROMISE entry must fail
    // the suite before it can leak to a cold-start render.
    expect([...HERO_PROMISE_MODULE_IDS].sort()).toEqual(
      [...DASHBOARD_MODULE_IDS].sort(),
    );
    for (const id of DASHBOARD_MODULE_IDS) {
      expect(HERO_PROMISE[id]).toBeDefined();
      expect(HERO_PROMISE[id].headline.length).toBeGreaterThan(0);
      expect(HERO_PROMISE[id].body.length).toBeGreaterThan(0);
      expect(HERO_PROMISE[id].ctaLabel.length).toBeGreaterThan(0);
    }
  });

  it("uses distinct headlines across the four modules", () => {
    // Distinctness is the whole point of per-module copy. A regression
    // that collapses two modules onto the same headline would silently
    // erode the activation lift the PR-09 hypothesis depends on.
    const headlines = new Set(
      DASHBOARD_MODULE_IDS.map((id) => HERO_PROMISE[id].headline),
    );
    expect(headlines.size).toBe(DASHBOARD_MODULE_IDS.length);
  });

  it("uses distinct CTA labels across the four modules", () => {
    const labels = new Set(
      DASHBOARD_MODULE_IDS.map((id) => HERO_PROMISE[id].ctaLabel),
    );
    expect(labels.size).toBe(DASHBOARD_MODULE_IDS.length);
  });

  it("blocks regressions to generic activation-bar framing", () => {
    // Pre-PR-09 cold-start used `<OnboardingProgress />` with «N/M
    // розділів готові» framing. The whole PR exists to delete that
    // framing — so block any HeroPromise copy that quietly reintroduces
    // it via a regex audit.
    const banned = [
      /\d\s*\/\s*\d/, // «2/4», «1 / 4» etc.
      /розділ(ів|и)\s*готов/i, // «розділів готові»
      /активован(о|их)\s*\d/i, // «активовано 2 з 4»
      /продовжуй\s+додавати/i, // PR-09 must not echo CelebrationModal
      // legacy generic «Продовжити» CTA: explicit standalone token
      // — pattern is anchored so legitimate verbs like
      // «Запланувати тренування» / «Створити звичку» do not trip.
      /^продовжити$/i,
    ];
    for (const id of DASHBOARD_MODULE_IDS) {
      const { headline, body, ctaLabel } = HERO_PROMISE[id];
      for (const pattern of banned) {
        expect(headline).not.toMatch(pattern);
        expect(body).not.toMatch(pattern);
        expect(ctaLabel).not.toMatch(pattern);
      }
    }
  });

  it("CTA labels are imperative + within the length budget", () => {
    // Hard limit 30 chars so the label never wraps on a 360-px phone
    // (the smallest target in the design system). The imperative
    // check is informal — we lock the budget and the
    // distinctness/banned-tokens guards above; copy reviewers own
    // tone.
    for (const id of DASHBOARD_MODULE_IDS) {
      const { ctaLabel } = HERO_PROMISE[id];
      expect(ctaLabel.length).toBeLessThanOrEqual(30);
      expect(ctaLabel.endsWith(".")).toBe(false);
      expect(ctaLabel.endsWith("!")).toBe(false);
      expect(ctaLabel.endsWith("…")).toBe(false);
    }
  });

  it("body copy stays within the phone-fit budget (≤ 110 chars)", () => {
    for (const id of DASHBOARD_MODULE_IDS) {
      const { body } = HERO_PROMISE[id];
      expect(body.length).toBeLessThanOrEqual(110);
    }
  });

  it("getHeroPromiseCopy returns module copy when given a known id", () => {
    expect(getHeroPromiseCopy("finyk")).toEqual(HERO_PROMISE.finyk);
    expect(getHeroPromiseCopy("nutrition")).toEqual(HERO_PROMISE.nutrition);
  });

  it("getHeroPromiseCopy returns null for null / undefined", () => {
    expect(getHeroPromiseCopy(null)).toBeNull();
    expect(getHeroPromiseCopy(undefined)).toBeNull();
  });
});
