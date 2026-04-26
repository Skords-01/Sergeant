#!/usr/bin/env node
// scripts/lint-migrations.mjs
//
// CI lint: enforces AGENTS.md rule #4 —
//   • sequential migration numbering (no gaps, no duplicates)
//   • two-phase DROP (no DROP COLUMN / DROP TABLE without escape-hatch)
//
// Usage:
//   BASE_REF=main node scripts/lint-migrations.mjs
//   node scripts/lint-migrations.mjs          # defaults BASE_REF to "main"
//
// The script exits 1 when violations are found.

import { readFileSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const MIGRATIONS_DIR = "apps/server/src/migrations";
const MIGRATION_FILE_RE = /^(\d{3})_.+\.sql$/;
const DOWN_FILE_RE = /\.down\.sql$/;
const DROP_RE = /\bDROP\s+(COLUMN|TABLE)\b/i;
const ALLOW_DROP_RE = /^--[ \t]*ALLOW_DROP:[ \t]*\S.*/m;

// ── Pure helpers (exported for tests) ────────────────────────────────────────

/** True when the trimmed line is a SQL single-line comment (`-- …`). */
export function isCommentLine(line) {
  return line.trimStart().startsWith("--");
}

/**
 * Returns `{ lineNumber, text }[]` for every non-comment line in `content`
 * that contains `DROP COLUMN` or `DROP TABLE` (case-insensitive).
 */
export function findDropLines(content) {
  return content
    .split("\n")
    .map((text, i) => ({ lineNumber: i + 1, text }))
    .filter(({ text }) => !isCommentLine(text) && DROP_RE.test(text));
}

/**
 * Returns `true` when the file content contains at least one
 * `-- ALLOW_DROP: <reason>` comment (the escape-hatch).
 */
export function hasAllowDropEscapeHatch(content) {
  return ALLOW_DROP_RE.test(content);
}

/**
 * Given an array of migration filenames (basenames), returns
 * `{ numbers, gaps, duplicates }` where:
 * - `numbers` — sorted array of migration prefix numbers
 * - `gaps`    — missing numbers in the sequence
 * - `duplicates` — numbers that appear more than once
 *
 * `.down.sql` files are excluded from the count.
 */
export function checkSequentialNumbers(filenames) {
  const numbers = filenames
    .filter((f) => !DOWN_FILE_RE.test(f))
    .map((f) => {
      const m = f.match(MIGRATION_FILE_RE);
      return m ? Number(m[1]) : null;
    })
    .filter((n) => n !== null)
    .sort((a, b) => a - b);

  const seen = new Set();
  const duplicates = [];
  for (const n of numbers) {
    if (seen.has(n)) {
      if (!duplicates.includes(n)) duplicates.push(n);
    }
    seen.add(n);
  }

  const gaps = [];
  if (numbers.length > 0) {
    for (let i = numbers[0]; i <= numbers[numbers.length - 1]; i++) {
      if (!seen.has(i)) gaps.push(i);
    }
  }

  return {
    numbers: [...new Set(numbers)].sort((a, b) => a - b),
    gaps,
    duplicates,
  };
}

// ── CLI runner ───────────────────────────────────────────────────────────────

export function run({
  migrationsDir = MIGRATIONS_DIR,
  changedFiles = null,
} = {}) {
  const baseRef = process.env.BASE_REF || "main";
  const errors = [];

  // 1. Determine which migration files are new/changed in this PR
  if (changedFiles === null) {
    try {
      const diff = execSync(
        `git diff --name-only --diff-filter=ACM origin/${baseRef} -- "${migrationsDir}"`,
        { encoding: "utf8" },
      ).trim();
      changedFiles = diff ? diff.split("\n") : [];
    } catch {
      console.warn(
        `⚠ Could not diff against origin/${baseRef}; checking all migration files.`,
      );
      changedFiles = readdirSync(migrationsDir)
        .filter((f) => MIGRATION_FILE_RE.test(f))
        .map((f) => join(migrationsDir, f));
    }
  }

  // 2. Check DROP statements in new/changed files (skip .down.sql)
  for (const filePath of changedFiles) {
    const name = basename(filePath);

    if (DOWN_FILE_RE.test(name)) continue;

    let content;
    try {
      content = readFileSync(filePath, "utf8");
    } catch {
      // File might have been deleted in diff — skip
      continue;
    }

    const dropLines = findDropLines(content);
    if (dropLines.length > 0 && !hasAllowDropEscapeHatch(content)) {
      for (const { lineNumber, text } of dropLines) {
        errors.push(
          [
            `❌ ${filePath}:${lineNumber}: "${text.trim()}"`,
            `   AGENTS.md rule #4 requires two-phase DROP:`,
            `   1. First PR: deploy code that stops using the column/table.`,
            `   2. Second PR: DROP in a new migration (only after phase 1 is live).`,
            `   Escape hatch: add a comment to the file:`,
            `     -- ALLOW_DROP: <reason> (due: YYYY-MM-DD)`,
            `   Ref: https://github.com/Skords-01/Sergeant/blob/main/AGENTS.md#4-sql-migrations-sequential-no-gaps-two-phase-for-drop`,
          ].join("\n"),
        );
      }
    }
  }

  // 3. Check sequential numbering across ALL migration files
  const allFiles = readdirSync(migrationsDir);
  const { gaps, duplicates } = checkSequentialNumbers(allFiles);

  if (gaps.length > 0) {
    const padded = gaps.map((n) => String(n).padStart(3, "0")).join(", ");
    errors.push(
      `❌ Migration numbering has gaps: ${padded}.\n` +
        `   AGENTS.md rule #4: sequential, no gaps.`,
    );
  }

  if (duplicates.length > 0) {
    const padded = duplicates.map((n) => String(n).padStart(3, "0")).join(", ");
    errors.push(
      `❌ Duplicate migration numbers: ${padded}.\n` +
        `   AGENTS.md rule #4: no duplicates.`,
    );
  }

  // 4. Report
  if (errors.length > 0) {
    console.error("\n🚫 Migration lint failed:\n");
    for (const e of errors) console.error(e + "\n");
    return { ok: false, errors };
  }

  console.log("✅ Migration lint passed.");
  return { ok: true, errors: [] };
}

// ── Entry point ──────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  const { ok } = run();
  if (!ok) process.exit(1);
}
