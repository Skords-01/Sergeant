// scripts/__tests__/lint-pii-handling-drift.test.mjs
//
// Unit tests for the pii-handling.md drift-guard (card S10,
// pr-plan-security-obs-2026-05).
// Run with: node --test scripts/__tests__/lint-pii-handling-drift.test.mjs

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  parseSharedKeys,
  parseDocKeys,
  diffKeys,
  run,
  SHARED_PII_PATH,
  DOC_PATH,
} from "../lint-pii-handling-drift.mjs";

// ── parseSharedKeys ───────────────────────────────────────────────────────────

const SHARED_SRC = `
export const PII_REDACTED = "[redacted]";
export const REDACT_KEY_NAMES: readonly string[] = [
  // Class A
  "password",
  "token",
  // commented-out keys must NOT count:
  // "ghostKey",
  "email",
  "phone",
];
const REDACT_KEY_SET = new Set(REDACT_KEY_NAMES.map((k) => k.toLowerCase()));
`;

describe("parseSharedKeys", () => {
  it("extracts the string literals from the array, in order", () => {
    assert.deepEqual(parseSharedKeys(SHARED_SRC), [
      "password",
      "token",
      "email",
      "phone",
    ]);
  });

  it("ignores keys that are commented out inside the array", () => {
    assert.ok(!parseSharedKeys(SHARED_SRC).includes("ghostKey"));
  });

  it("throws when the declaration is missing", () => {
    assert.throws(
      () => parseSharedKeys("export const SOMETHING_ELSE = [];"),
      /could not find the `REDACT_KEY_NAMES = \[`/,
    );
  });
});

// ── parseDocKeys ──────────────────────────────────────────────────────────────

const DOC_SRC = `
# PII handling

intro paragraph with an inline \`code\` span that must be ignored.

<!-- pii-keys-start -->

- \`password\`
- \`token\`
- \`email\`
- \`phone\`

<!-- pii-keys-end -->

trailing \`anotherIgnored\` span outside the markers.
`;

describe("parseDocKeys", () => {
  it("extracts only the code spans between the markers", () => {
    assert.deepEqual(parseDocKeys(DOC_SRC), [
      "password",
      "token",
      "email",
      "phone",
    ]);
  });

  it("does not pick up code spans outside the marker block", () => {
    const keys = parseDocKeys(DOC_SRC);
    assert.ok(!keys.includes("code"));
    assert.ok(!keys.includes("anotherIgnored"));
  });

  it("throws when the markers are missing", () => {
    assert.throws(
      () => parseDocKeys("# no markers here"),
      /could not find the `<!-- pii-keys-start -->`/,
    );
  });
});

// ── diffKeys ──────────────────────────────────────────────────────────────────

describe("diffKeys", () => {
  it("reports ok when both sets match (case-insensitive)", () => {
    const r = diffKeys(["Token", "Email"], ["token", "email"]);
    assert.equal(r.ok, true);
    assert.deepEqual(r.missingInDoc, []);
    assert.deepEqual(r.extraInDoc, []);
  });

  it("is order-independent", () => {
    const r = diffKeys(["email", "token"], ["token", "email"]);
    assert.equal(r.ok, true);
  });

  it("flags a key present in shared but missing from the doc", () => {
    const r = diffKeys(["token", "email", "newKey"], ["token", "email"]);
    assert.equal(r.ok, false);
    assert.deepEqual(r.missingInDoc, ["newKey"]);
    assert.deepEqual(r.extraInDoc, []);
  });

  it("flags a key present in the doc but missing from shared", () => {
    const r = diffKeys(["token"], ["token", "staleKey"]);
    assert.equal(r.ok, false);
    assert.deepEqual(r.missingInDoc, []);
    assert.deepEqual(r.extraInDoc, ["staleKey"]);
  });
});

// ── run() integration with stubbed fs ─────────────────────────────────────────

describe("run", () => {
  it("passes when the doc mirrors the shared list", () => {
    const result = run({
      read: (p) => (p === SHARED_PII_PATH ? SHARED_SRC : DOC_SRC),
    });
    assert.equal(result.ok, true);
    assert.equal(result.error, null);
    assert.equal(result.sharedCount, 4);
    assert.equal(result.docCount, 4);
  });

  it("fails when a key is removed from the shared source (fixture drift)", () => {
    // Acceptance criterion: removing a shared key while the doc keeps it
    // must make the guard fail.
    const drifted = SHARED_SRC.replace(/\s*"phone",/, "");
    const result = run({
      read: (p) => (p === SHARED_PII_PATH ? drifted : DOC_SRC),
    });
    assert.equal(result.ok, false);
    assert.deepEqual(result.missingInDoc, []);
    assert.deepEqual(result.extraInDoc, ["phone"]);
  });

  it("fails when a key is added to the shared source but not documented", () => {
    const drifted = SHARED_SRC.replace('"phone",', '"phone",\n  "ssn",');
    const result = run({
      read: (p) => (p === SHARED_PII_PATH ? drifted : DOC_SRC),
    });
    assert.equal(result.ok, false);
    assert.deepEqual(result.missingInDoc, ["ssn"]);
  });

  it("returns a parse error when the doc markers are missing", () => {
    const result = run({
      read: (p) => (p === SHARED_PII_PATH ? SHARED_SRC : "# no markers"),
    });
    assert.equal(result.ok, false);
    assert.match(result.error, /pii-keys-start/);
  });

  it("real repo files are in sync (guards live drift)", () => {
    // No injected read → exercises the actual pii.ts + pii-handling.md.
    const result = run();
    assert.equal(
      result.ok,
      true,
      `Drift detected between ${SHARED_PII_PATH} and ${DOC_PATH}: ` +
        `missingInDoc=[${result.missingInDoc}] extraInDoc=[${result.extraInDoc}] ` +
        `error=${result.error}`,
    );
  });
});
