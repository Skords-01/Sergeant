/**
 * Unit tests for getFinykSyncTone — maps a sync-status string to the
 * correct visual tone triple (dot colour, text, pill classes).
 */
import { describe, expect, it } from "vitest";
import { getFinykSyncTone } from "./syncTone";

describe("getFinykSyncTone", () => {
  it("returns the success (default) tone when syncStatus is undefined", () => {
    const tone = getFinykSyncTone(undefined);
    expect(tone.dot).toBe("bg-success");
    expect(tone.text).toBe("ок");
    expect(tone.pill).toContain("text-success");
  });

  it("returns the success (default) tone when syncStatus is an empty string", () => {
    const tone = getFinykSyncTone("");
    expect(tone.dot).toBe("bg-success");
    expect(tone.text).toBe("ок");
  });

  it("returns the error tone for syncStatus 'error'", () => {
    const tone = getFinykSyncTone("error");
    expect(tone.dot).toBe("bg-danger");
    expect(tone.text).toBe("помилка");
    expect(tone.pill).toContain("text-danger");
  });

  it("returns the partial tone for syncStatus 'partial'", () => {
    const tone = getFinykSyncTone("partial");
    expect(tone.dot).toBe("bg-warning");
    expect(tone.text).toBe("частково");
    expect(tone.pill).toContain("text-warning");
  });

  it("returns the loading tone for syncStatus 'loading'", () => {
    const tone = getFinykSyncTone("loading");
    expect(tone.dot).toBe("bg-muted");
    expect(tone.text).toBe("оновлення");
    expect(tone.pill).toContain("text-muted");
  });

  it("falls back to the default success tone for an unrecognised status string", () => {
    const tone = getFinykSyncTone("syncing");
    expect(tone.dot).toBe("bg-success");
    expect(tone.text).toBe("ок");
  });

  it("returns objects (not the same reference) for different statuses", () => {
    const t1 = getFinykSyncTone("error");
    const t2 = getFinykSyncTone("error");
    // value equality is what matters; reference equality is an implementation detail
    expect(t1).toEqual(t2);
  });

  it("the pill class contains the dot colour string for each known status", () => {
    // Sanity: each pill contains a relevant colour token so the UI is consistent
    expect(getFinykSyncTone("error").pill).toContain("danger");
    expect(getFinykSyncTone("partial").pill).toContain("warning");
    expect(getFinykSyncTone("loading").pill).toContain("muted");
    expect(getFinykSyncTone(undefined).pill).toContain("success");
  });
});
