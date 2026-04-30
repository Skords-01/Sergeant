// scripts/docs/__tests__/generate-hard-rules-matrix.test.mjs
//
// Unit + integration tests for the hard-rules registry generator.
// Pure helpers (loadRegistry / renderMatrix / anchorFromTitle) get
// exhaustive coverage; the on-disk registry is sanity-checked so a
// malformed JSON edit fails before reaching `--check` in CI.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  loadRegistry,
  renderMatrix,
  renderMatrixRaw,
  anchorFromTitle,
  formatMarkdown,
} from "../generate-hard-rules-matrix.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../..");
const REGISTRY_PATH = resolve(REPO_ROOT, "docs/governance/hard-rules.json");

// Fixture used across tests: minimum valid registry shape.
const FIXTURE = {
  version: "1.0",
  generatedFrom: "AGENTS.md § Hard rules",
  rules: [
    {
      id: "HR-1",
      title: "DB types: coerce bigint to number in serializers",
      summary: "The pg driver returns bigint as string; coerce in serializer.",
      category: "data-integrity",
      severity: "error",
      since: "2026-02-01",
      owner: "@Skords-01",
      appliesTo: ["apps/server/src/modules/**"],
      enforcement: [
        {
          kind: "test",
          path: "apps/server/src/modules/**/*.test.ts",
          what: "Snapshot tests catch stringified bigints.",
        },
      ],
      seeAlso: ["docs/playbooks/add-api-endpoint.md"],
    },
    {
      id: "HR-2",
      title: "RQ keys: only via centralized factories",
      summary: "Always use queryKeys.ts factories.",
      category: "code-quality",
      severity: "convention",
      owner: "@Skords-01",
    },
  ],
};

// ── loadRegistry ──────────────────────────────────────────────────────────────

test("loadRegistry: accepts the fixture verbatim", () => {
  const r = loadRegistry(FIXTURE);
  assert.equal(r.rules.length, 2);
  assert.equal(r.rules[0].id, "HR-1");
});

test("loadRegistry: parses JSON strings", () => {
  const r = loadRegistry(JSON.stringify(FIXTURE));
  assert.equal(r.rules.length, 2);
});

test("loadRegistry: rejects non-object input", () => {
  assert.throws(() => loadRegistry(null), /expected an object/);
  assert.throws(() => loadRegistry(JSON.stringify(42)), /expected an object/);
});

test("loadRegistry: rejects missing rules array", () => {
  assert.throws(() => loadRegistry({ version: "1.0" }), /must be an array/);
});

test("loadRegistry: rejects empty rules array", () => {
  assert.throws(
    () => loadRegistry({ version: "1.0", rules: [] }),
    /at least one rule/,
  );
});

test("loadRegistry: rejects malformed id", () => {
  const bad = structuredClone(FIXTURE);
  bad.rules[0].id = "rule1";
  assert.throws(() => loadRegistry(bad), /matching \^HR-/);
});

test("loadRegistry: rejects duplicate ids", () => {
  const bad = structuredClone(FIXTURE);
  bad.rules[1].id = "HR-1";
  assert.throws(() => loadRegistry(bad), /duplicate rule id HR-1/);
});

test("loadRegistry: rejects missing required field", () => {
  const bad = structuredClone(FIXTURE);
  delete bad.rules[0].owner;
  assert.throws(() => loadRegistry(bad), /missing one of/);
});

// ── anchorFromTitle ──────────────────────────────────────────────────────────

test("anchorFromTitle: GitHub-compatible slug for HR-1", () => {
  assert.equal(
    anchorFromTitle(
      "HR-1",
      "DB types: coerce `bigint` to `number` in serializers",
    ),
    "1-db-types-coerce-bigint-to-number-in-serializers",
  );
});

test("anchorFromTitle: strips backticks, asterisks, quotes", () => {
  assert.equal(
    anchorFromTitle(
      "HR-9",
      "Saturated brand fills behind `text-white` must use the `-strong` companion",
    ),
    "9-saturated-brand-fills-behind-text-white-must-use-the-strong-companion",
  );
});

test("anchorFromTitle: collapses runs of non-alnum to single dash", () => {
  assert.equal(
    anchorFromTitle("HR-3", "API contract: server ↔ client ↔ test"),
    "3-api-contract-server-client-test",
  );
});

test("anchorFromTitle: trims leading/trailing dashes", () => {
  assert.equal(
    anchorFromTitle("HR-7", "—pre-commit hooks—"),
    "7-pre-commit-hooks",
  );
});

// ── renderMatrix ─────────────────────────────────────────────────────────────

test("renderMatrix: includes the AUTO-GENERATED banner", () => {
  const out = renderMatrixRaw(FIXTURE, {
    now: new Date("2026-04-30T00:00:00Z"),
  });
  assert.match(out, /AUTO-GENERATED FILE\. Do not edit by hand/);
});

test("renderMatrix: includes a freshness header bumped to `now`", () => {
  const out = renderMatrixRaw(FIXTURE, {
    now: new Date("2026-04-30T00:00:00Z"),
  });
  assert.match(out, /\*\*Last validated:\*\* 2026-04-30 by @devin-ai/);
  assert.match(out, /\*\*Next review:\*\* 2026-07-29/);
});

test("renderMatrix: emits exactly one row per rule", () => {
  const out = renderMatrixRaw(FIXTURE, {
    now: new Date("2026-04-30T00:00:00Z"),
  });
  const dataRows = out.split("\n").filter((l) => l.startsWith("| **HR-"));
  assert.equal(dataRows.length, 2);
});

test("renderMatrix: links rule title to AGENTS.md anchor", () => {
  const out = renderMatrixRaw(FIXTURE, {
    now: new Date("2026-04-30T00:00:00Z"),
  });
  assert.match(
    out,
    /\[DB types: coerce bigint to number in serializers\]\(\.\.\/\.\.\/AGENTS\.md#1-db-types-coerce-bigint-to-number-in-serializers\)/,
  );
});

test("renderMatrix: shows enforcement list for HR-1 (test) and `—` for HR-2 (none)", () => {
  const out = renderMatrixRaw(FIXTURE, {
    now: new Date("2026-04-30T00:00:00Z"),
  });
  assert.match(out, /Test `apps\/server\/src\/modules\/\*\*\/\*\.test\.ts`/);
  // HR-2 has no enforcement → dash
  const hr2Line = out.split("\n").find((l) => l.startsWith("| **HR-2**"));
  assert.ok(hr2Line, "HR-2 row missing");
  assert.ok(
    hr2Line.includes("| — |"),
    `HR-2 should have a dash in the seeAlso/enforcement column, got: ${hr2Line}`,
  );
});

test("renderMatrix: severity gets a badge", () => {
  const out = renderMatrixRaw(FIXTURE, {
    now: new Date("2026-04-30T00:00:00Z"),
  });
  assert.match(out, /🛑 error/);
  assert.match(out, /📜 convention/);
});

test("renderMatrix: deterministic — two calls with the same `now` produce identical output", () => {
  const a = renderMatrixRaw(FIXTURE, { now: new Date("2026-04-30T00:00:00Z") });
  const b = renderMatrixRaw(FIXTURE, { now: new Date("2026-04-30T00:00:00Z") });
  assert.equal(a, b);
});

test("renderMatrix: handles all enforcement kinds without crashing", () => {
  const reg = {
    version: "1.0",
    rules: [
      {
        id: "HR-1",
        title: "every kind",
        summary: "covers all enforcement variants",
        category: "process",
        severity: "error",
        owner: "@Skords-01",
        enforcement: [
          { kind: "eslint", rule: "x/y", level: "error" },
          { kind: "test", path: "**/*.test.ts" },
          { kind: "script", path: "scripts/x.mjs" },
          { kind: "workflow", workflow: ".github/workflows/x.yml" },
          { kind: "branch-protection" },
          { kind: "manual", what: "review" },
        ],
      },
    ],
  };
  const out = renderMatrixRaw(reg, { now: new Date("2026-04-30T00:00:00Z") });
  assert.match(out, /ESLint `x\/y` \(error\)/);
  assert.match(out, /Test `\*\*\/\*\.test\.ts`/);
  assert.match(out, /Script.*scripts\/x\.mjs/);
  assert.match(out, /Workflow.*x\.yml/);
  assert.match(out, /Branch protection/);
  assert.match(out, /Manual \/ review-only/);
});

test("renderMatrix: escapes pipes inside cell content", () => {
  const reg = {
    version: "1.0",
    rules: [
      {
        id: "HR-1",
        title: "title with | pipe",
        summary: "summary",
        category: "process",
        severity: "warning",
        owner: "@Skords-01",
        enforcement: [{ kind: "manual", what: "a | b" }],
      },
    ],
  };
  const out = renderMatrixRaw(reg, { now: new Date("2026-04-30T00:00:00Z") });
  // pipe in title should be escaped so the table renders correctly
  assert.match(out, /title with \\\| pipe/);
});

// ── async renderMatrix + formatMarkdown ──────────────────────────────────────

test("renderMatrix (async): returns Prettier-clean markdown", async () => {
  const out = await renderMatrix(FIXTURE, {
    now: new Date("2026-04-30T00:00:00Z"),
  });
  // Idempotent under formatMarkdown: re-formatting yields the same string.
  const reformatted = await formatMarkdown(out);
  assert.equal(out, reformatted);
});

test("renderMatrix (async): preserves the same rule rows as renderMatrixRaw", async () => {
  const raw = renderMatrixRaw(FIXTURE, {
    now: new Date("2026-04-30T00:00:00Z"),
  });
  const formatted = await renderMatrix(FIXTURE, {
    now: new Date("2026-04-30T00:00:00Z"),
  });
  // Both must mention every rule id; whitespace/alignment may differ.
  for (const r of FIXTURE.rules) {
    assert.match(raw, new RegExp(`\\*\\*${r.id}\\*\\*`));
    assert.match(formatted, new RegExp(`\\*\\*${r.id}\\*\\*`));
  }
});

// ── On-disk registry ─────────────────────────────────────────────────────────

test("on-disk: docs/governance/hard-rules.json is parseable + valid", () => {
  const raw = readFileSync(REGISTRY_PATH, "utf8");
  const reg = loadRegistry(raw);
  assert.ok(
    reg.rules.length >= 15,
    `expected ≥15 rules, got ${reg.rules.length}`,
  );
  // all severities are real values
  for (const r of reg.rules) {
    assert.ok(
      ["error", "warning", "convention"].includes(r.severity),
      `${r.id} has bad severity: ${r.severity}`,
    );
    // appliesTo (when present) is an array of strings
    if (r.appliesTo) assert.ok(Array.isArray(r.appliesTo), `${r.id}.appliesTo`);
    // enforcement (when present) is an array
    if (r.enforcement)
      assert.ok(Array.isArray(r.enforcement), `${r.id}.enforcement`);
  }
});

test("on-disk: registry ids are HR-1…HR-N with no gaps", () => {
  const raw = readFileSync(REGISTRY_PATH, "utf8");
  const reg = loadRegistry(raw);
  const nums = reg.rules.map((r) => Number(r.id.replace(/^HR-/, "")));
  nums.sort((a, b) => a - b);
  for (let i = 0; i < nums.length; i++) {
    assert.equal(
      nums[i],
      i + 1,
      `expected HR-${i + 1} at position ${i}, got HR-${nums[i]}`,
    );
  }
});
