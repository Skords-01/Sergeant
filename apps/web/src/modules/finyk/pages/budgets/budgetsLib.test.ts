import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  proactiveCacheKey,
  PROACTIVE_CACHE_TTL,
  loadProactiveAdviceFromLS,
  saveProactiveAdviceToLS,
} from "./budgetsLib";

// Mock the finykStorage readJSON / writeJSON used inside budgetsLib
vi.mock("../../lib/finykStorage", () => {
  const store: Record<string, unknown> = {};
  return {
    readJSON: (key: string, fallback: unknown = null) =>
      key in store ? store[key] : fallback,
    writeJSON: (key: string, value: unknown) => {
      store[key] = value;
      return true;
    },
    __store: store,
  };
});

// Access the in-memory store the mock exposes so we can seed/inspect it
async function getStore(): Promise<Record<string, unknown>> {
  const mod = await import("../../lib/finykStorage");
  return (mod as unknown as { __store: Record<string, unknown> }).__store;
}

describe("proactiveCacheKey", () => {
  it("includes both categoryId and monthKey in the output", () => {
    const k = proactiveCacheKey("food", "2026-05");
    expect(k).toContain("food");
    expect(k).toContain("2026-05");
  });

  it("produces different keys for different categoryIds", () => {
    expect(proactiveCacheKey("food", "2026-05")).not.toBe(
      proactiveCacheKey("transport", "2026-05"),
    );
  });

  it("produces different keys for different monthKeys", () => {
    expect(proactiveCacheKey("food", "2026-05")).not.toBe(
      proactiveCacheKey("food", "2026-06"),
    );
  });
});

describe("PROACTIVE_CACHE_TTL", () => {
  it("is 24 hours in milliseconds", () => {
    expect(PROACTIVE_CACHE_TTL).toBe(24 * 60 * 60 * 1000);
  });
});

describe("loadProactiveAdviceFromLS", () => {
  beforeEach(async () => {
    const store = await getStore();
    Object.keys(store).forEach((k) => delete store[k]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when cache is empty", () => {
    const result = loadProactiveAdviceFromLS("food", "2026-05");
    expect(result).toBeNull();
  });

  it("returns cached text when within TTL", async () => {
    const store = await getStore();
    const key = proactiveCacheKey("food", "2026-05");
    store[key] = { text: "Buy less coffee", ts: Date.now() };

    const result = loadProactiveAdviceFromLS("food", "2026-05");
    expect(result).not.toBeNull();
    expect(result?.text).toBe("Buy less coffee");
  });

  it("returns null when cache is expired (older than TTL)", async () => {
    const store = await getStore();
    const key = proactiveCacheKey("food", "2026-05");
    // Set timestamp older than TTL
    store[key] = {
      text: "Old advice",
      ts: Date.now() - PROACTIVE_CACHE_TTL - 1,
    };

    const result = loadProactiveAdviceFromLS("food", "2026-05");
    expect(result).toBeNull();
  });

  it("returns null for malformed cache (no text field)", async () => {
    const store = await getStore();
    const key = proactiveCacheKey("food", "2026-05");
    store[key] = { ts: Date.now() };

    const result = loadProactiveAdviceFromLS("food", "2026-05");
    expect(result).toBeNull();
  });

  it("returns null for malformed cache (no ts field)", async () => {
    const store = await getStore();
    const key = proactiveCacheKey("food", "2026-05");
    store[key] = { text: "Some advice" };

    const result = loadProactiveAdviceFromLS("food", "2026-05");
    expect(result).toBeNull();
  });
});

describe("saveProactiveAdviceToLS", () => {
  beforeEach(async () => {
    const store = await getStore();
    Object.keys(store).forEach((k) => delete store[k]);
  });

  it("saves and makes loadable within TTL", () => {
    saveProactiveAdviceToLS("food", "2026-05", "Spend less on snacks");
    const result = loadProactiveAdviceFromLS("food", "2026-05");
    expect(result?.text).toBe("Spend less on snacks");
  });

  it("scopes cache by category and month", () => {
    saveProactiveAdviceToLS("food", "2026-05", "Advice A");
    saveProactiveAdviceToLS("transport", "2026-05", "Advice B");

    expect(loadProactiveAdviceFromLS("food", "2026-05")?.text).toBe("Advice A");
    expect(loadProactiveAdviceFromLS("transport", "2026-05")?.text).toBe(
      "Advice B",
    );
  });
});
