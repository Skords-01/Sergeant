import { describe, it, expect } from "vitest";
import { fmt } from "./numberFmt";

describe("fmt", () => {
  it("formats a positive integer with 0 decimal places by default", () => {
    expect(fmt(42)).toBe("42");
  });

  it("formats a positive float with 0 decimal places (truncates — via toFixed)", () => {
    expect(fmt(3.7)).toBe("4");
  });

  it("formats with explicit digit count", () => {
    expect(fmt(1.5, 2)).toBe("1.50");
    expect(fmt(100, 1)).toBe("100.0");
  });

  it("returns '—' for null", () => {
    expect(fmt(null)).toBe("—");
  });

  it("returns '—' for undefined", () => {
    expect(fmt(undefined)).toBe("—");
  });

  it("returns '—' for NaN (via string '?')", () => {
    expect(fmt("not-a-number")).toBe("—");
  });

  it("returns '—' for Infinity", () => {
    expect(fmt(Infinity)).toBe("—");
  });

  it("returns '—' for -Infinity", () => {
    expect(fmt(-Infinity)).toBe("—");
  });

  it("handles zero correctly", () => {
    expect(fmt(0)).toBe("0");
    expect(fmt(0, 2)).toBe("0.00");
  });

  it("accepts numeric strings", () => {
    expect(fmt("5.5", 1)).toBe("5.5");
  });

  it("formats negative numbers", () => {
    expect(fmt(-3, 0)).toBe("-3");
    expect(fmt(-1.2, 1)).toBe("-1.2");
  });
});
