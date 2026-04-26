// scripts/__tests__/lint-migrations.test.mjs
//
// Unit tests for the migration linter (AGENTS.md rule #4).
// Run with: node --test scripts/__tests__/lint-migrations.test.mjs

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  isCommentLine,
  findDropLines,
  hasAllowDropEscapeHatch,
  checkSequentialNumbers,
  run,
} from "../lint-migrations.mjs";

// ── isCommentLine ────────────────────────────────────────────────────────────

describe("isCommentLine", () => {
  it("returns true for lines starting with --", () => {
    assert.equal(isCommentLine("-- this is a comment"), true);
    assert.equal(isCommentLine("  -- indented comment"), true);
    assert.equal(isCommentLine("--no space"), true);
  });

  it("returns false for non-comment lines", () => {
    assert.equal(isCommentLine("DROP TABLE foo;"), false);
    assert.equal(isCommentLine("ALTER TABLE foo DROP COLUMN bar;"), false);
    assert.equal(isCommentLine("SELECT '--not a comment';"), false);
    assert.equal(isCommentLine(""), false);
  });
});

// ── findDropLines ────────────────────────────────────────────────────────────

describe("findDropLines", () => {
  it("finds DROP TABLE statements", () => {
    const content = "CREATE TABLE foo;\nDROP TABLE bar;\nSELECT 1;";
    const result = findDropLines(content);
    assert.equal(result.length, 1);
    assert.equal(result[0].lineNumber, 2);
    assert.ok(result[0].text.includes("DROP TABLE"));
  });

  it("finds DROP COLUMN statements", () => {
    const content = "ALTER TABLE foo\n  DROP COLUMN bar;";
    const result = findDropLines(content);
    assert.equal(result.length, 1);
    assert.equal(result[0].lineNumber, 2);
  });

  it("ignores comment lines containing DROP", () => {
    const content = "-- DROP TABLE old_table;\nSELECT 1;";
    const result = findDropLines(content);
    assert.equal(result.length, 0);
  });

  it("is case-insensitive", () => {
    const lines = [
      "drop table foo;",
      "Drop Column bar;",
      "DROP   TABLE baz;",
      "DROP\tCOLUMN qux;",
    ];
    for (const line of lines) {
      const result = findDropLines(line);
      assert.equal(result.length, 1, `Expected match for: ${line}`);
    }
  });

  it("returns empty for clean SQL", () => {
    const content =
      "CREATE TABLE foo (id INT);\nALTER TABLE foo ADD COLUMN bar TEXT;";
    assert.equal(findDropLines(content).length, 0);
  });

  it("finds multiple DROP statements in one file", () => {
    const content = "DROP TABLE a;\nSELECT 1;\nALTER TABLE b DROP COLUMN c;";
    assert.equal(findDropLines(content).length, 2);
  });
});

// ── hasAllowDropEscapeHatch ──────────────────────────────────────────────────

describe("hasAllowDropEscapeHatch", () => {
  it("returns true when ALLOW_DROP comment exists", () => {
    const content =
      "-- ALLOW_DROP: legacy cleanup (due: 2026-06-01)\nDROP TABLE foo;";
    assert.equal(hasAllowDropEscapeHatch(content), true);
  });

  it("returns true for minimal ALLOW_DROP", () => {
    assert.equal(
      hasAllowDropEscapeHatch("-- ALLOW_DROP: reason\nDROP TABLE x;"),
      true,
    );
  });

  it("returns false when no ALLOW_DROP comment", () => {
    assert.equal(hasAllowDropEscapeHatch("DROP TABLE foo;"), false);
  });

  it("returns false for ALLOW_DROP without reason", () => {
    assert.equal(
      hasAllowDropEscapeHatch("-- ALLOW_DROP:\nDROP TABLE x;"),
      false,
    );
  });

  it("returns false for ALLOW_DROP in non-comment context", () => {
    assert.equal(
      hasAllowDropEscapeHatch("SELECT 'ALLOW_DROP: reason';"),
      false,
    );
  });
});

// ── checkSequentialNumbers ───────────────────────────────────────────────────

describe("checkSequentialNumbers", () => {
  it("passes for sequential files", () => {
    const files = ["001_init.sql", "002_foo.sql", "003_bar.sql"];
    const { gaps, duplicates } = checkSequentialNumbers(files);
    assert.deepEqual(gaps, []);
    assert.deepEqual(duplicates, []);
  });

  it("detects gaps", () => {
    const files = ["001_init.sql", "003_bar.sql"];
    const { gaps } = checkSequentialNumbers(files);
    assert.deepEqual(gaps, [2]);
  });

  it("detects multiple gaps", () => {
    const files = ["001_init.sql", "005_bar.sql"];
    const { gaps } = checkSequentialNumbers(files);
    assert.deepEqual(gaps, [2, 3, 4]);
  });

  it("detects duplicates", () => {
    const files = ["001_init.sql", "001_other.sql", "002_bar.sql"];
    const { duplicates } = checkSequentialNumbers(files);
    assert.deepEqual(duplicates, [1]);
  });

  it("ignores .down.sql files in numbering", () => {
    const files = [
      "001_init.sql",
      "001_init.down.sql",
      "002_bar.sql",
      "002_bar.down.sql",
    ];
    const { gaps, duplicates } = checkSequentialNumbers(files);
    assert.deepEqual(gaps, []);
    assert.deepEqual(duplicates, []);
  });

  it("ignores non-migration files", () => {
    const files = ["README.md", "001_init.sql", "002_bar.sql"];
    const { gaps, duplicates, numbers } = checkSequentialNumbers(files);
    assert.deepEqual(numbers, [1, 2]);
    assert.deepEqual(gaps, []);
    assert.deepEqual(duplicates, []);
  });

  it("handles empty list", () => {
    const { gaps, duplicates, numbers } = checkSequentialNumbers([]);
    assert.deepEqual(numbers, []);
    assert.deepEqual(gaps, []);
    assert.deepEqual(duplicates, []);
  });
});

// ── run() integration tests (with temp dirs) ────────────────────────────────

describe("run() — integration", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "migration-lint-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("happy path — clean migrations pass", () => {
    writeFileSync(join(tmpDir, "001_init.sql"), "CREATE TABLE foo (id INT);\n");
    writeFileSync(
      join(tmpDir, "002_add_bar.sql"),
      "ALTER TABLE foo ADD COLUMN bar TEXT;\n",
    );

    const { ok, errors } = run({
      migrationsDir: tmpDir,
      changedFiles: [join(tmpDir, "002_add_bar.sql")],
    });
    assert.equal(ok, true);
    assert.equal(errors.length, 0);
  });

  it("fails when DROP TABLE found without escape-hatch", () => {
    writeFileSync(join(tmpDir, "001_init.sql"), "CREATE TABLE foo (id INT);\n");
    writeFileSync(join(tmpDir, "002_drop_foo.sql"), "DROP TABLE foo;\n");

    const { ok, errors } = run({
      migrationsDir: tmpDir,
      changedFiles: [join(tmpDir, "002_drop_foo.sql")],
    });
    assert.equal(ok, false);
    assert.ok(errors.some((e) => e.includes("DROP TABLE")));
    assert.ok(errors.some((e) => e.includes("AGENTS.md rule #4")));
  });

  it("fails when DROP COLUMN found without escape-hatch", () => {
    writeFileSync(
      join(tmpDir, "001_init.sql"),
      "CREATE TABLE foo (id INT, bar TEXT);\n",
    );
    writeFileSync(
      join(tmpDir, "002_drop_col.sql"),
      "ALTER TABLE foo DROP COLUMN bar;\n",
    );

    const { ok, errors } = run({
      migrationsDir: tmpDir,
      changedFiles: [join(tmpDir, "002_drop_col.sql")],
    });
    assert.equal(ok, false);
    assert.ok(errors.some((e) => e.includes("DROP COLUMN")));
  });

  it("passes when DROP has ALLOW_DROP escape-hatch", () => {
    writeFileSync(join(tmpDir, "001_init.sql"), "CREATE TABLE foo (id INT);\n");
    writeFileSync(
      join(tmpDir, "002_drop_foo.sql"),
      "-- ALLOW_DROP: column unused since PR #500 (due: 2026-06-01)\nDROP TABLE foo;\n",
    );

    const { ok } = run({
      migrationsDir: tmpDir,
      changedFiles: [join(tmpDir, "002_drop_foo.sql")],
    });
    assert.equal(ok, true);
  });

  it("allows DROP in .down.sql files", () => {
    writeFileSync(join(tmpDir, "001_init.sql"), "CREATE TABLE foo (id INT);\n");
    writeFileSync(join(tmpDir, "001_init.down.sql"), "DROP TABLE foo;\n");

    const { ok } = run({
      migrationsDir: tmpDir,
      changedFiles: [join(tmpDir, "001_init.down.sql")],
    });
    assert.equal(ok, true);
  });

  it("ignores DROP inside SQL comments", () => {
    writeFileSync(join(tmpDir, "001_init.sql"), "CREATE TABLE foo (id INT);\n");
    writeFileSync(
      join(tmpDir, "002_note.sql"),
      "-- Note: we will DROP TABLE foo later in a separate migration\nSELECT 1;\n",
    );

    const { ok } = run({
      migrationsDir: tmpDir,
      changedFiles: [join(tmpDir, "002_note.sql")],
    });
    assert.equal(ok, true);
  });

  it("fails on gaps in migration numbering", () => {
    writeFileSync(join(tmpDir, "001_init.sql"), "SELECT 1;\n");
    writeFileSync(join(tmpDir, "003_skip.sql"), "SELECT 1;\n");

    const { ok, errors } = run({
      migrationsDir: tmpDir,
      changedFiles: [],
    });
    assert.equal(ok, false);
    assert.ok(errors.some((e) => e.includes("gaps")));
  });

  it("fails on duplicate migration numbers", () => {
    writeFileSync(join(tmpDir, "001_init.sql"), "SELECT 1;\n");
    writeFileSync(join(tmpDir, "001_other.sql"), "SELECT 1;\n");
    writeFileSync(join(tmpDir, "002_bar.sql"), "SELECT 1;\n");

    const { ok, errors } = run({
      migrationsDir: tmpDir,
      changedFiles: [],
    });
    assert.equal(ok, false);
    assert.ok(errors.some((e) => e.includes("Duplicate")));
  });
});
