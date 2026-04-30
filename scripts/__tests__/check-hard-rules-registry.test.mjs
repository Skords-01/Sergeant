// scripts/__tests__/check-hard-rules-registry.test.mjs
//
// Negative-case tests for scripts/check-hard-rules-registry.mjs. We run the
// real script against fixture trees in os.tmpdir() so the CLI surface (which
// CI invokes) is the thing under test.
//
// The fixtures are deliberately tiny: 2 rules instead of 15, just enough to
// exercise each failure mode.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = resolve(__dirname, "..", "check-hard-rules-registry.mjs");
const SCRIPT_SRC = readFileSync(SCRIPT_PATH, "utf-8");
const SCHEMA_PATH = resolve(
  __dirname,
  "..",
  "..",
  "docs",
  "governance",
  "hard-rules.schema.json",
);
const SCHEMA_SRC = readFileSync(SCHEMA_PATH, "utf-8");

function buildFixture({ registry, agentsRules, contribRules }) {
  const dir = mkdtempSync(join(tmpdir(), "hard-rules-test-"));
  const root = join(dir, "repo");
  mkdirSync(join(root, "scripts"), { recursive: true });
  mkdirSync(join(root, "docs", "governance"), { recursive: true });
  writeFileSync(
    join(root, "scripts", "check-hard-rules-registry.mjs"),
    SCRIPT_SRC,
  );
  writeFileSync(
    join(root, "docs", "governance", "hard-rules.schema.json"),
    SCHEMA_SRC,
  );
  writeFileSync(
    join(root, "docs", "governance", "hard-rules.json"),
    JSON.stringify(registry, null, 2),
  );

  const agentsBody =
    "## Hard rules (do not break)\n\n" +
    agentsRules.map((r) => `### ${r.id}. ${r.title}\n\nbody.\n`).join("\n") +
    "\n## Soft rules\n\nsomething.\n";
  writeFileSync(join(root, "AGENTS.md"), agentsBody);

  const contribBody = contribRules
    .map((r) => `${r.id}. **${r.title}**\n\nbody.\n`)
    .join("\n");
  writeFileSync(join(root, "CONTRIBUTING.md"), contribBody);

  return {
    dir,
    root,
    scriptDest: join(root, "scripts", "check-hard-rules-registry.mjs"),
  };
}

function run(scriptDest) {
  const r = spawnSync(process.execPath, [scriptDest, "--json"], {
    encoding: "utf-8",
  });
  return { ...r, json: r.stdout ? safeParse(r.stdout) : null };
}

function safeParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

const minimalRule = (id, title) => ({
  id,
  title,
  scope: ["**/*"],
  severity: "blocker",
  enforced_by: [{ kind: "doc", ref: "docs/some.md" }],
});

test("happy path with 2 rules in sync passes", () => {
  const { dir, scriptDest } = buildFixture({
    registry: {
      version: 1,
      source: "AGENTS.md",
      rules: [minimalRule(1, "First"), minimalRule(2, "Second")],
    },
    agentsRules: [
      { id: 1, title: "First" },
      { id: 2, title: "Second" },
    ],
    contribRules: [
      { id: 1, title: "First" },
      { id: 2, title: "Second" },
    ],
  });
  try {
    const r = run(scriptDest);
    assert.equal(
      r.status,
      0,
      `expected exit 0, got ${r.status} stderr: ${r.stderr}`,
    );
    assert.equal(r.json.ok, true);
    assert.equal(r.json.ruleCount, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("title drift between registry and AGENTS.md fails with agents-sync error", () => {
  const { dir, scriptDest } = buildFixture({
    registry: {
      version: 1,
      source: "AGENTS.md",
      rules: [minimalRule(1, "Original Title"), minimalRule(2, "Second")],
    },
    agentsRules: [
      { id: 1, title: "Drifted Title" },
      { id: 2, title: "Second" },
    ],
    contribRules: [
      { id: 1, title: "Original Title" },
      { id: 2, title: "Second" },
    ],
  });
  try {
    const r = run(scriptDest);
    assert.equal(r.status, 1);
    assert.ok(
      r.json.errors.some((e) => /title drift/.test(e)),
      `expected title-drift error, got: ${JSON.stringify(r.json.errors)}`,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("rule missing from CONTRIBUTING.md fails with contrib-sync error", () => {
  const { dir, scriptDest } = buildFixture({
    registry: {
      version: 1,
      source: "AGENTS.md",
      rules: [minimalRule(1, "First"), minimalRule(2, "Second")],
    },
    agentsRules: [
      { id: 1, title: "First" },
      { id: 2, title: "Second" },
    ],
    contribRules: [{ id: 1, title: "First" }], // rule 2 missing
  });
  try {
    const r = run(scriptDest);
    assert.equal(r.status, 1);
    assert.ok(
      r.json.errors.some((e) => /contrib-sync.*#2/.test(e)),
      `expected contrib-sync error for rule #2, got: ${JSON.stringify(r.json.errors)}`,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("non-dense numbering (gap) fails with numbering error", () => {
  const { dir, scriptDest } = buildFixture({
    registry: {
      version: 1,
      source: "AGENTS.md",
      rules: [minimalRule(1, "First"), minimalRule(3, "Third")],
    },
    agentsRules: [
      { id: 1, title: "First" },
      { id: 3, title: "Third" },
    ],
    contribRules: [
      { id: 1, title: "First" },
      { id: 3, title: "Third" },
    ],
  });
  try {
    const r = run(scriptDest);
    assert.equal(r.status, 1);
    assert.ok(
      r.json.errors.some((e) => /not dense/.test(e)),
      `expected dense-numbering error, got: ${JSON.stringify(r.json.errors)}`,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("schema violation (unknown enforced_by.kind) fails with schema error", () => {
  const { dir, scriptDest } = buildFixture({
    registry: {
      version: 1,
      source: "AGENTS.md",
      rules: [
        {
          id: 1,
          title: "First",
          scope: ["**/*"],
          severity: "blocker",
          enforced_by: [{ kind: "magic-wand", ref: "x" }], // not in enum
        },
      ],
    },
    agentsRules: [{ id: 1, title: "First" }],
    contribRules: [{ id: 1, title: "First" }],
  });
  try {
    const r = run(scriptDest);
    assert.equal(r.status, 1);
    assert.ok(
      r.json.errors.some((e) => /schema.*kind/.test(e) || /not one of/.test(e)),
      `expected schema enum error, got: ${JSON.stringify(r.json.errors)}`,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("AGENTS.md has rule the registry forgot fails with agents-sync error", () => {
  const { dir, scriptDest } = buildFixture({
    registry: {
      version: 1,
      source: "AGENTS.md",
      rules: [minimalRule(1, "First")],
    },
    agentsRules: [
      { id: 1, title: "First" },
      { id: 2, title: "Forgotten" },
    ],
    contribRules: [
      { id: 1, title: "First" },
      { id: 2, title: "Forgotten" },
    ],
  });
  try {
    const r = run(scriptDest);
    assert.equal(r.status, 1);
    assert.ok(
      r.json.errors.some((e) =>
        /agents-sync.*Hard Rule #2.*registry does not/.test(e),
      ),
      `expected agents-sync forgotten-rule error, got: ${JSON.stringify(r.json.errors)}`,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
