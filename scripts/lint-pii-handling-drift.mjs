#!/usr/bin/env node
// scripts/lint-pii-handling-drift.mjs
//
// Drift-guard: keeps the machine-readable key list in
// `docs/security/pii-handling.md` in sync with the canonical
// `REDACT_KEY_NAMES` exported from `packages/shared/src/lib/pii.ts`.
//
// Why this exists (card S10, pr-plan-security-obs-2026-05):
//   STRIDE-I — Information disclosure through documentation drift. If someone
//   adds a new redacted key to the shared module but the doc still lists the
//   old set, another engineer may reverse-add an API without redaction
//   ("it wasn't in the list yet"). The reverse drift (key documented but not
//   enforced) gives false confidence that a field is masked. Both directions
//   fail this gate.
//
// What it compares:
//   - SOURCE OF TRUTH: the string literals inside the `REDACT_KEY_NAMES`
//     array in `packages/shared/src/lib/pii.ts`.
//   - DOC MIRROR: `` `key` `` entries between the
//     `<!-- pii-keys-start -->` and `<!-- pii-keys-end -->` markers in
//     `docs/security/pii-handling.md`.
//   Comparison is case-insensitive and order-independent (set equality),
//   mirroring `REDACT_KEY_SET` in pii.ts which lowercases at match time.
//
// Usage:
//   node scripts/lint-pii-handling-drift.mjs
//
// Exit code 1 on any drift (missing-in-doc, extra-in-doc, parse failure).

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");

export const SHARED_PII_PATH = "packages/shared/src/lib/pii.ts";
export const DOC_PATH = "docs/security/pii-handling.md";
export const DOC_MARKER_START = "<!-- pii-keys-start -->";
export const DOC_MARKER_END = "<!-- pii-keys-end -->";

// ── Parsers ──────────────────────────────────────────────────────────────────

/**
 * Extract the string literals from the `REDACT_KEY_NAMES` array in pii.ts.
 * Returns the keys in source order (deduped later via set comparison).
 * Throws if the array declaration cannot be located.
 */
export function parseSharedKeys(source) {
  const declRe = /REDACT_KEY_NAMES[^=]*=\s*\[/;
  const declMatch = declRe.exec(source);
  if (!declMatch) {
    throw new Error(
      `could not find the \`REDACT_KEY_NAMES = [\` declaration in ${SHARED_PII_PATH}`,
    );
  }
  const start = declMatch.index + declMatch[0].length;
  const end = source.indexOf("]", start);
  if (end === -1) {
    throw new Error(
      `could not find the closing \`]\` of \`REDACT_KEY_NAMES\` in ${SHARED_PII_PATH}`,
    );
  }
  const body = source.slice(start, end);
  // Strip line comments so a commented-out `// "foo",` is never counted.
  const withoutComments = body.replace(/\/\/[^\n]*/g, "");
  const keys = [];
  const strRe = /["'`]([^"'`]+)["'`]/g;
  let m;
  while ((m = strRe.exec(withoutComments)) !== null) {
    keys.push(m[1]);
  }
  return keys;
}

/**
 * Extract the documented keys from the marker-delimited block in
 * pii-handling.md. Each key is an inline-code span (`` `key` ``) on its own
 * bullet line. Throws if the markers are missing or empty.
 */
export function parseDocKeys(doc) {
  const startIdx = doc.indexOf(DOC_MARKER_START);
  const endIdx = doc.indexOf(DOC_MARKER_END);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error(
      `could not find the \`${DOC_MARKER_START}\` … \`${DOC_MARKER_END}\` block in ${DOC_PATH}`,
    );
  }
  if (endIdx < startIdx) {
    throw new Error(
      `\`${DOC_MARKER_END}\` appears before \`${DOC_MARKER_START}\` in ${DOC_PATH}`,
    );
  }
  const block = doc.slice(startIdx + DOC_MARKER_START.length, endIdx);
  const keys = [];
  const codeRe = /`([^`]+)`/g;
  let m;
  while ((m = codeRe.exec(block)) !== null) {
    keys.push(m[1]);
  }
  return keys;
}

/**
 * Compare two key lists as case-insensitive sets. Returns
 * `{ ok, missingInDoc, extraInDoc }` where the diff arrays carry the
 * canonical (source) casing where available, else the doc casing.
 */
export function diffKeys(sharedKeys, docKeys) {
  const norm = (k) => k.toLowerCase();
  const sharedByNorm = new Map(sharedKeys.map((k) => [norm(k), k]));
  const docByNorm = new Map(docKeys.map((k) => [norm(k), k]));

  const missingInDoc = [];
  for (const [n, original] of sharedByNorm) {
    if (!docByNorm.has(n)) missingInDoc.push(original);
  }
  const extraInDoc = [];
  for (const [n, original] of docByNorm) {
    if (!sharedByNorm.has(n)) extraInDoc.push(original);
  }
  return {
    ok: missingInDoc.length === 0 && extraInDoc.length === 0,
    missingInDoc,
    extraInDoc,
  };
}

// ── Runner (fs injectable for tests) ─────────────────────────────────────────

/**
 * @param {object} [opts]
 * @param {(relPath: string) => string} [opts.read] reads a repo-relative file.
 * @returns {{ ok: boolean, error: string|null, missingInDoc: string[],
 *             extraInDoc: string[], sharedCount: number, docCount: number }}
 */
export function run(opts = {}) {
  const read =
    opts.read ?? ((relPath) => readFileSync(resolve(ROOT, relPath), "utf8"));

  let sharedKeys;
  let docKeys;
  try {
    sharedKeys = parseSharedKeys(read(SHARED_PII_PATH));
    docKeys = parseDocKeys(read(DOC_PATH));
  } catch (err) {
    return {
      ok: false,
      error: err.message,
      missingInDoc: [],
      extraInDoc: [],
      sharedCount: 0,
      docCount: 0,
    };
  }

  const { ok, missingInDoc, extraInDoc } = diffKeys(sharedKeys, docKeys);
  return {
    ok,
    error: null,
    missingInDoc,
    extraInDoc,
    sharedCount: sharedKeys.length,
    docCount: docKeys.length,
  };
}

export function formatReport(result) {
  const lines = [];
  if (result.error) {
    lines.push(`❌ pii-handling drift-guard could not run: ${result.error}`);
    return lines.join("\n");
  }
  if (result.ok) {
    lines.push(
      `✅ pii-handling.md mirrors all ${result.sharedCount} \`REDACT_KEY_NAMES\` ` +
        `from ${SHARED_PII_PATH}.`,
    );
    return lines.join("\n");
  }
  lines.push(
    `❌ ${DOC_PATH} has drifted from \`REDACT_KEY_NAMES\` in ${SHARED_PII_PATH}.`,
  );
  if (result.missingInDoc.length > 0) {
    lines.push(
      `   Keys in shared but NOT documented (add them to the ` +
        `${DOC_MARKER_START} block): ${result.missingInDoc.join(", ")}`,
    );
  }
  if (result.extraInDoc.length > 0) {
    lines.push(
      `   Keys documented but NOT in shared (remove them, or re-add to ` +
        `REDACT_KEY_NAMES): ${result.extraInDoc.join(", ")}`,
    );
  }
  lines.push(
    "   The shared module is the single source of truth — edit it, then " +
      "mirror the change into the marker block in the same PR.",
  );
  return lines.join("\n");
}

// ── Entry point ──────────────────────────────────────────────────────────────

if (process.argv[1] === __filename) {
  const result = run();
  const report = formatReport(result);
  if (result.ok) {
    console.log(report);
  } else {
    console.error(report);
    process.exit(1);
  }
}
