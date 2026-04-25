import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import {
  safeReadLS,
  safeReadStringLS,
  safeWriteLS,
  safeRemoveLS,
} from "./storage";

// vitest is configured with environment: "node" so we need a minimal
// localStorage polyfill for these tests.
beforeAll(() => {
  if (typeof globalThis.localStorage === "undefined") {
    const store = new Map();
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => {
        store.set(k, String(v));
      },
      removeItem: (k) => {
        store.delete(k);
      },
      clear: () => store.clear(),
      key: (i) => Array.from(store.keys())[i] ?? null,
      get length() {
        return store.size;
      },
    };
  }
});

describe("shared storage helpers", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("safeReadLS returns fallback when key is missing", () => {
    expect(safeReadLS("missing", { a: 1 })).toEqual({ a: 1 });
    expect(safeReadLS("missing")).toBeNull();
  });

  it("safeReadLS returns fallback when JSON is malformed", () => {
    localStorage.setItem("bad", "{not json");
    expect(safeReadLS("bad", [])).toEqual([]);
  });

  it("safeReadLS returns fallback when stored value is null", () => {
    localStorage.setItem("nully", "null");
    expect(safeReadLS("nully", "x")).toBe("x");
  });

  it("safeReadLS parses stored JSON", () => {
    localStorage.setItem("k", JSON.stringify({ a: 1, b: [2, 3] }));
    expect(safeReadLS("k")).toEqual({ a: 1, b: [2, 3] });
  });

  it("safeReadStringLS returns raw string without parsing", () => {
    localStorage.setItem("token", "raw-value-123");
    expect(safeReadStringLS("token")).toBe("raw-value-123");
    expect(safeReadStringLS("missing", "fallback")).toBe("fallback");
  });

  it("safeWriteLS serializes objects and returns true on success", () => {
    expect(safeWriteLS("obj", { x: 1 })).toBe(true);
    expect(JSON.parse(localStorage.getItem("obj"))).toEqual({ x: 1 });
  });

  it("safeWriteLS stores raw strings without double-quoting", () => {
    expect(safeWriteLS("s", "hello")).toBe(true);
    expect(localStorage.getItem("s")).toBe("hello");
  });

  it("safeRemoveLS deletes the key", () => {
    localStorage.setItem("x", "1");
    expect(safeRemoveLS("x")).toBe(true);
    expect(localStorage.getItem("x")).toBeNull();
  });
});
