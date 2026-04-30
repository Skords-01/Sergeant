#!/usr/bin/env node
// scripts/docs/generate-hard-rules-matrix.mjs
//
// Read the structured registry at `docs/governance/hard-rules.json` and
// emit `docs/governance/hard-rules-matrix.md` — a table that shows, for
// every hard rule, its category / severity / enforcement mechanism /
// related playbooks. The full prose stays in `AGENTS.md § Hard rules`;
// this matrix is the **index** that connects each rule to the code,
// scripts, and tests that enforce it.
//
// Why both files: AGENTS.md is the human contract (narrative, examples,
// rationale). The matrix is the machine-friendly cross-reference an agent
// or reviewer can grep in one second to answer "which ESLint rule
// implements HR-13?" without reading 60 lines of prose.
//
// Usage:
//   node scripts/docs/generate-hard-rules-matrix.mjs            # write the matrix
//   node scripts/docs/generate-hard-rules-matrix.mjs --check    # CI mode: fail if diff
//   node scripts/docs/generate-hard-rules-matrix.mjs --list     # CLI: print plain-text list
//
// Exit code 1 on --check diff or invalid registry.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import prettier from "prettier";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "../..");
const REGISTRY_PATH = resolve(REPO_ROOT, "docs/governance/hard-rules.json");
const MATRIX_PATH = resolve(REPO_ROOT, "docs/governance/hard-rules-matrix.md");

// ── Registry loading + validation ────────────────────────────────────────────

/**
 * Load and minimally validate the registry. We keep the validator inline
 * (no JSON-Schema runtime dep) — it only checks the invariants the
 * generator depends on. Full schema lives in `hard-rules.schema.json`.
 */
export function loadRegistry(rawJson) {
  const parsed = typeof rawJson === "string" ? JSON.parse(rawJson) : rawJson;
  if (!parsed || typeof parsed !== "object")
    throw new Error("registry: expected an object");
  if (!Array.isArray(parsed.rules))
    throw new Error("registry: `rules` must be an array");
  if (parsed.rules.length === 0)
    throw new Error("registry: at least one rule is required");

  const seen = new Set();
  for (const r of parsed.rules) {
    if (!r.id || !/^HR-\d+$/.test(r.id))
      throw new Error(
        `registry: every rule needs an id matching ^HR-\\d+$ (got ${JSON.stringify(r.id)})`,
      );
    if (seen.has(r.id)) throw new Error(`registry: duplicate rule id ${r.id}`);
    seen.add(r.id);
    if (!r.title || !r.summary || !r.category || !r.severity || !r.owner)
      throw new Error(
        `registry: ${r.id} is missing one of: title / summary / category / severity / owner`,
      );
  }
  return parsed;
}

// ── Markdown rendering ───────────────────────────────────────────────────────

const SEVERITY_BADGE = {
  error: "🛑 error",
  warning: "⚠️ warning",
  convention: "📜 convention",
};

function describeEnforcement(item) {
  switch (item.kind) {
    case "eslint":
      return `ESLint \`${item.rule}\`${item.level ? ` (${item.level})` : ""}`;
    case "test":
      return `Test \`${item.path}\``;
    case "script":
      return `Script [\`${item.path}\`](../../${item.path})`;
    case "workflow":
      return `Workflow [\`${item.workflow}\`](../../${item.workflow})`;
    case "branch-protection":
      return `Branch protection (GitHub settings)`;
    case "manual":
      return `Manual / review-only`;
    default:
      return `Unknown (${item.kind})`;
  }
}

function escapePipes(s) {
  return String(s).replace(/\|/g, "\\|");
}

function renderEnforcement(rule) {
  const items = rule.enforcement ?? [];
  if (items.length === 0) return "—";
  return items.map(describeEnforcement).map(escapePipes).join("<br>");
}

function renderSeeAlso(rule) {
  const items = rule.seeAlso ?? [];
  if (items.length === 0) return "—";
  return items
    .map((s) => {
      if (s.startsWith("http")) {
        const label = s.replace(/^https?:\/\/(www\.)?/, "");
        return `[${label}](${s})`;
      }
      return `[\`${s}\`](../../${s})`;
    })
    .map(escapePipes)
    .join("<br>");
}

function renderAppliesTo(rule) {
  const items = rule.appliesTo ?? [];
  if (items.length === 0) return "repo-wide";
  return items
    .map((p) => `\`${p}\``)
    .map(escapePipes)
    .join("<br>");
}

/**
 * Format a markdown string with the repo's Prettier config. Async because
 * prettier.format returns a Promise. Resolves Prettier config from a path
 * inside the repo so options like `proseWrap` are honoured.
 */
export async function formatMarkdown(
  content,
  { configPath = MATRIX_PATH } = {},
) {
  const opts = (await prettier.resolveConfig(configPath)) ?? {};
  return prettier.format(content, { ...opts, parser: "markdown" });
}

/**
 * Build the matrix markdown and run it through Prettier so the on-disk
 * file matches `pnpm format:check`. Async wrapper around `renderMatrixRaw`.
 */
export async function renderMatrix(registry, opts = {}) {
  const raw = renderMatrixRaw(registry, opts);
  return formatMarkdown(raw);
}

/**
 * Build the full matrix markdown without running it through Prettier.
 * Pure (no I/O); kept exported so tests can assert against the structural
 * output without depending on Prettier's table-alignment behaviour.
 */
export function renderMatrixRaw(registry, { now = new Date() } = {}) {
  const today = now.toISOString().slice(0, 10);
  const nextReview = new Date(now);
  nextReview.setUTCDate(nextReview.getUTCDate() + 90);
  const nextReviewISO = nextReview.toISOString().slice(0, 10);

  const lines = [];
  lines.push("# Hard rules — enforcement matrix");
  lines.push("");
  lines.push(
    `> **Last validated:** ${today} by @devin-ai. **Next review:** ${nextReviewISO}.`,
  );
  lines.push(`> **Status:** Active`);
  lines.push("");
  lines.push(
    "<!-- AUTO-GENERATED FILE. Do not edit by hand. Source: `docs/governance/hard-rules.json`. Regenerate via `pnpm hard-rules:generate`. -->",
  );
  lines.push("");
  lines.push(
    `Цей файл — машино-читабельний індекс із **${registry.rules.length}** Hard rules. Повні описи живуть в [\`AGENTS.md § Hard rules\`](../../AGENTS.md#hard-rules-do-not-break) — це джерело правди для людей. Реєстр у [\`hard-rules.json\`](./hard-rules.json) — джерело правди для скриптів. Матриця нижче — їх перетин: одним поглядом видно, **який механізм** ловить порушення кожного правила.`,
  );
  lines.push("");
  lines.push("## Quick links");
  lines.push("");
  lines.push("- Реєстр (JSON): [`hard-rules.json`](./hard-rules.json)");
  lines.push("- Schema: [`hard-rules.schema.json`](./hard-rules.schema.json)");
  lines.push(
    "- Generator: [`scripts/docs/generate-hard-rules-matrix.mjs`](../../scripts/docs/generate-hard-rules-matrix.mjs)",
  );
  lines.push("- CLI: `pnpm hard-rules:list` (plain-text dump for code-review)");
  lines.push("");
  lines.push("## Matrix");
  lines.push("");
  lines.push(
    "| ID | Rule | Category | Severity | Applies to | Enforcement | See also |",
  );
  lines.push(
    "| --- | ---- | -------- | -------- | ---------- | ----------- | -------- |",
  );
  for (const rule of registry.rules) {
    lines.push(
      [
        `**${rule.id}**`,
        `[${escapePipes(rule.title)}](../../AGENTS.md#${anchorFromTitle(rule.id, rule.title)})`,
        `\`${rule.category}\``,
        SEVERITY_BADGE[rule.severity] ?? rule.severity,
        renderAppliesTo(rule),
        renderEnforcement(rule),
        renderSeeAlso(rule),
      ]
        .map((c) => `| ${c} `)
        .join("") + "|",
    );
  }
  lines.push("");
  lines.push("## Severity legend");
  lines.push("");
  lines.push("| Severity | Meaning |");
  lines.push("| -------- | ------- |");
  lines.push(
    "| 🛑 `error` | CI / lint blocks merge. The rule is enforced before code can land. |",
  );
  lines.push(
    "| ⚠️ `warning` | Lint warns but does not block. Reviewer is expected to triage. |",
  );
  lines.push(
    "| 📜 `convention` | Enforced via review or playbooks only — no automatic gate. |",
  );
  lines.push("");
  lines.push("## How to add a rule");
  lines.push("");
  lines.push(
    "1. Append a new entry to [`hard-rules.json`](./hard-rules.json) (next `HR-N` id).",
  );
  lines.push(
    "2. Write the human-readable description in [`AGENTS.md § Hard rules`](../../AGENTS.md#hard-rules-do-not-break) using the same numbering.",
  );
  lines.push(
    "3. Run `pnpm hard-rules:generate` and commit the regenerated `hard-rules-matrix.md` in the same PR.",
  );
  lines.push(
    "4. CI will re-run `pnpm hard-rules:check` to confirm the matrix is in sync.",
  );
  lines.push("");
  lines.push(
    "> See also: [`docs/playbooks/add-hard-rule.md`](../playbooks/add-hard-rule.md).",
  );
  lines.push("");
  return lines.join("\n");
}

/**
 * Slugify a rule heading the way GitHub does, so anchors in AGENTS.md
 * resolve. Format: `1-db-types-coerce-bigint-to-number-in-serializers`.
 */
export function anchorFromTitle(id, title) {
  const num = id.replace(/^HR-/, "");
  const slug = title
    .toLowerCase()
    .replace(/[`*'"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${num}-${slug}`;
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function readRegistryFromDisk() {
  const raw = readFileSync(REGISTRY_PATH, "utf8");
  return loadRegistry(raw);
}

function renderPlainList(registry) {
  const lines = [
    `Hard rules — ${registry.rules.length} entries (registry v${registry.version})`,
    "",
  ];
  for (const r of registry.rules) {
    const enf =
      (r.enforcement ?? []).map(describeEnforcement).join("; ") || "—";
    lines.push(`${r.id}  [${r.severity.toUpperCase()}]  ${r.title}`);
    lines.push(`        ${r.summary}`);
    lines.push(`        category: ${r.category}    owner: ${r.owner}`);
    lines.push(`        enforcement: ${enf}`);
    lines.push("");
  }
  return lines.join("\n");
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const args = process.argv.slice(2);
  const registry = readRegistryFromDisk();

  if (args.includes("--list")) {
    process.stdout.write(renderPlainList(registry) + "\n");
    process.exit(0);
  }

  const next = await renderMatrix(registry);
  if (args.includes("--check")) {
    let current = "";
    try {
      current = readFileSync(MATRIX_PATH, "utf8");
    } catch {
      // missing file — treated as a diff
    }
    if (current !== next) {
      console.error(
        `${MATRIX_PATH} is out of date. Run \`pnpm hard-rules:generate\` and commit.`,
      );
      process.exit(1);
    }
    console.log(`${MATRIX_PATH} is up to date.`);
    process.exit(0);
  }

  writeFileSync(MATRIX_PATH, next);
  console.log(`Wrote ${MATRIX_PATH} — ${registry.rules.length} rules indexed.`);
}
