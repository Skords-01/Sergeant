import { describe, expect, it } from "vitest";

import { createMemoryKVStore, readJSON, writeJSON } from "./kvStore";

describe("createMemoryKVStore", () => {
  it("returns null for missing keys", () => {
    const s = createMemoryKVStore();
    expect(s.getString("x")).toBeNull();
  });

  it("round-trips strings through set/get", () => {
    const s = createMemoryKVStore();
    s.setString("k", "v");
    expect(s.getString("k")).toBe("v");
  });

  it("honours the initial seed payload", () => {
    const s = createMemoryKVStore({ seeded: "yes" });
    expect(s.getString("seeded")).toBe("yes");
  });

  it("removes keys without throwing on unknown ids", () => {
    const s = createMemoryKVStore({ a: "1" });
    s.remove("a");
    s.remove("missing");
    expect(s.getString("a")).toBeNull();
  });
});

describe("readJSON / writeJSON", () => {
  it("parses round-tripped JSON", () => {
    const s = createMemoryKVStore();
    writeJSON(s, "k", { a: 1, b: [true, null] });
    expect(readJSON(s, "k")).toEqual({ a: 1, b: [true, null] });
  });

  it("returns null for missing slots", () => {
    expect(readJSON(createMemoryKVStore(), "missing")).toBeNull();
  });

  it("returns null for malformed JSON instead of throwing", () => {
    const s = createMemoryKVStore({ k: "{not-json" });
    expect(readJSON(s, "k")).toBeNull();
  });

  it("writeJSON silently no-ops on cyclic input", () => {
    const s = createMemoryKVStore();
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => writeJSON(s, "k", cyclic)).not.toThrow();
    expect(s.getString("k")).toBeNull();
  });
});
