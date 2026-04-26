import { describe, it, expect } from "vitest";
import {
  ASSISTANT_CAPABILITIES,
  CAPABILITY_MODULE_ORDER,
  CAPABILITY_MODULE_META,
  getQuickActionCapabilities,
  groupCapabilitiesByModule,
  searchCapabilities,
  type CapabilityModule,
} from "./assistantCatalogue";

// Mirrors RISKY_TOOLS in apps/web/src/core/lib/hubChatActionCards.ts.
// Hardcoded here because @sergeant/shared cannot depend on app code.
const RISKY_TOOL_IDS = new Set<string>([
  "delete_transaction",
  "hide_transaction",
  "forget",
  "archive_habit",
  "import_monobank_range",
]);

describe("ASSISTANT_CAPABILITIES — invariants", () => {
  it("has unique ids", () => {
    const ids = ASSISTANT_CAPABILITIES.map((c) => c.id);
    const seen = new Set<string>();
    for (const id of ids) {
      expect(seen.has(id), `duplicate id: ${id}`).toBe(false);
      seen.add(id);
    }
  });

  it("uses snake_case ids", () => {
    for (const c of ASSISTANT_CAPABILITIES) {
      expect(c.id, c.id).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it("requiresInput=true ⇒ prompt ends with ': '", () => {
    for (const c of ASSISTANT_CAPABILITIES) {
      if (c.requiresInput) {
        expect(c.prompt.endsWith(": "), `${c.id}: ${c.prompt}`).toBe(true);
      } else {
        expect(c.prompt.endsWith(": "), `${c.id}: ${c.prompt}`).toBe(false);
        expect(c.prompt.length).toBeGreaterThan(0);
      }
    }
  });

  it("every module has ≥1 entry", () => {
    const modules = new Set(ASSISTANT_CAPABILITIES.map((c) => c.module));
    for (const m of CAPABILITY_MODULE_ORDER) {
      expect(modules.has(m), `module ${m} has no capabilities`).toBe(true);
    }
  });

  it("CAPABILITY_MODULE_META has entry for every module", () => {
    for (const m of CAPABILITY_MODULE_ORDER) {
      expect(CAPABILITY_MODULE_META[m], m).toBeDefined();
      expect(CAPABILITY_MODULE_META[m].title.length).toBeGreaterThan(0);
    }
  });

  it("risky=true entries are also in client RISKY_TOOLS set", () => {
    const registryRisky = new Set(
      ASSISTANT_CAPABILITIES.filter((c) => c.risky).map((c) => c.id),
    );
    // Every risky in registry must be known to the action-card layer.
    for (const id of registryRisky) {
      expect(
        RISKY_TOOL_IDS.has(id),
        `${id} marked risky but missing from RISKY_TOOLS`,
      ).toBe(true);
    }
    // Every RISKY_TOOL must have a risky catalogue entry (so user
    // sees the warning badge before triggering it).
    for (const id of RISKY_TOOL_IDS) {
      expect(
        registryRisky.has(id),
        `${id} in RISKY_TOOLS but missing risky catalogue entry`,
      ).toBe(true);
    }
  });

  it("isQuickAction entries have priority and online flag", () => {
    for (const c of ASSISTANT_CAPABILITIES) {
      if (c.isQuickAction) {
        expect(
          typeof c.quickActionPriority,
          `${c.id} isQuickAction without priority`,
        ).toBe("number");
        // Quick actions hit Anthropic, so they always need network.
        expect(c.requiresOnline, `${c.id} quick action must be online`).toBe(
          true,
        );
      }
    }
  });

  it("has a reasonable total count (sanity)", () => {
    // Spec calls for ~60 entries; allow a small drift.
    expect(ASSISTANT_CAPABILITIES.length).toBeGreaterThanOrEqual(50);
    expect(ASSISTANT_CAPABILITIES.length).toBeLessThanOrEqual(80);
  });

  it("each entry has at least one example", () => {
    for (const c of ASSISTANT_CAPABILITIES) {
      expect(c.examples.length, `${c.id} has no examples`).toBeGreaterThan(0);
    }
  });
});

describe("getQuickActionCapabilities", () => {
  it("returns only quick actions, sorted by priority asc", () => {
    const qa = getQuickActionCapabilities();
    expect(qa.length).toBeGreaterThan(0);
    expect(qa.every((c) => c.isQuickAction === true)).toBe(true);
    for (let i = 1; i < qa.length; i++) {
      expect(qa[i]!.quickActionPriority ?? 999).toBeGreaterThanOrEqual(
        qa[i - 1]!.quickActionPriority ?? 999,
      );
    }
  });
});

describe("groupCapabilitiesByModule", () => {
  it("preserves module order from CAPABILITY_MODULE_ORDER", () => {
    const groups = groupCapabilitiesByModule();
    const seenOrder = groups.map((g) => g.module);
    let lastIdx = -1;
    for (const m of seenOrder) {
      const idx = CAPABILITY_MODULE_ORDER.indexOf(m);
      expect(idx).toBeGreaterThan(lastIdx);
      lastIdx = idx;
    }
  });

  it("contains every capability exactly once", () => {
    const groups = groupCapabilitiesByModule();
    const flat = groups.flatMap((g) => g.capabilities);
    expect(flat.length).toBe(ASSISTANT_CAPABILITIES.length);
  });
});

describe("searchCapabilities", () => {
  it("returns all when query is empty", () => {
    expect(searchCapabilities("").length).toBe(ASSISTANT_CAPABILITIES.length);
    expect(searchCapabilities("   ").length).toBe(
      ASSISTANT_CAPABILITIES.length,
    );
  });

  it("matches by label", () => {
    const r = searchCapabilities("Ранковий");
    expect(r.some((c) => c.id === "morning_briefing")).toBe(true);
  });

  it("matches by example phrasing", () => {
    const r = searchCapabilities("каву");
    expect(r.some((c) => c.id === "create_transaction")).toBe(true);
  });

  it("matches by keyword", () => {
    const r = searchCapabilities("workout");
    expect(r.some((c) => c.id === "start_workout")).toBe(true);
  });

  it("is case-insensitive", () => {
    const lower = searchCapabilities("звичка");
    const upper = searchCapabilities("ЗВИЧКА");
    expect(lower.length).toBe(upper.length);
  });

  it("matches by module name", () => {
    const r = searchCapabilities("nutrition");
    const moduleEntries = ASSISTANT_CAPABILITIES.filter(
      (c) => c.module === ("nutrition" satisfies CapabilityModule),
    );
    // All nutrition entries must be in the result (their module string contains 'nutrition').
    for (const c of moduleEntries) {
      expect(r.some((x) => x.id === c.id)).toBe(true);
    }
  });
});
