#!/usr/bin/env node
// scripts/check-governance-sync.mjs
//
// CI script that validates governance document consistency:
//
// 1. Hard Rules sync: every "### N." heading in AGENTS.md § Hard rules
//    must have a matching "N. **..." entry in CONTRIBUTING.md § Hard rules.
//
// 2. Status badge coverage: every doc with a "Last validated:" freshness
//    header must also have a "> **Status:** ..." line (Hard Rule #10).
//
// 3. Dangling source refs: inline code refs like `apps/.../*.ts` or
//    `packages/.../*.ts` in docs are checked against the filesystem.
//    Files in ADRs with Status: proposed are exempt (future refs OK).
//
// Usage:
//   node scripts/check-governance-sync.mjs            # warnings + errors
//   node scripts/check-governance-sync.mjs --strict   # treat new dangling refs as errors
//
// Exit code 1 on any failure (or on warnings in --strict mode).

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const STRICT = process.argv.includes("--strict");

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");

let errors = 0;
let warnings = 0;

function error(msg) {
  console.error(`❌ ${msg}`);
  errors++;
}

function warn(msg) {
  console.warn(`⚠️  ${msg}`);
  warnings++;
}

function ok(msg) {
  console.log(`✅ ${msg}`);
}

// ── Check 1: Hard Rules sync ─────────────────────────────────────────────────

function checkHardRulesSync() {
  console.log(
    "\n── Check 1: Hard Rules sync (AGENTS.md ↔ CONTRIBUTING.md) ──\n",
  );

  const agentsContent = readFileSync(resolve(ROOT, "AGENTS.md"), "utf-8");
  const contribContent = readFileSync(
    resolve(ROOT, "CONTRIBUTING.md"),
    "utf-8",
  );

  // Extract rule numbers from AGENTS.md (### N. ...)
  const agentsRuleRe = /^### (\d+)\.\s+(.+)$/gm;
  const agentsRules = new Map();
  let match;
  while ((match = agentsRuleRe.exec(agentsContent)) !== null) {
    agentsRules.set(parseInt(match[1], 10), match[2].trim());
  }

  // Extract rule numbers from CONTRIBUTING.md (N. **...**)
  const contribRuleRe = /^(\d+)\.\s+\*\*(.+?)\*\*/gm;
  const contribRules = new Set();
  while ((match = contribRuleRe.exec(contribContent)) !== null) {
    contribRules.add(parseInt(match[1], 10));
  }

  let synced = 0;
  for (const [num, title] of agentsRules) {
    if (contribRules.has(num)) {
      synced++;
    } else {
      error(
        `Hard Rule #${num} ("${title}") exists in AGENTS.md but is missing from CONTRIBUTING.md § Hard rules.`,
      );
    }
  }

  if (synced === agentsRules.size && agentsRules.size > 0) {
    ok(`All ${agentsRules.size} Hard Rules are mirrored in CONTRIBUTING.md.`);
  }
}

// ── Check 2: Status badge coverage ───────────────────────────────────────────

function checkStatusBadges() {
  console.log("\n── Check 2: Status badge coverage (freshness → Status:) ──\n");

  const mdFiles = findMdFiles(ROOT);
  let hasFreshness = 0;
  let hasStatus = 0;
  let missing = 0;

  for (const file of mdFiles) {
    const relPath = relative(ROOT, file);

    // Skip ADRs — they use their own Status format
    if (relPath.startsWith("docs/adr/") && !relPath.endsWith("README.md")) {
      continue;
    }
    // Skip templates
    if (relPath.includes("TEMPLATE")) continue;
    // Skip node_modules, .git, etc.
    if (
      relPath.startsWith("node_modules") ||
      relPath.startsWith(".git/") ||
      relPath.startsWith("apps/") ||
      relPath.startsWith("packages/")
    ) {
      continue;
    }

    const content = readFileSync(file, "utf-8");
    const lines = content.split("\n").slice(0, 15);
    const headerBlock = lines.join("\n");

    const hasFreshnessMarker =
      /\*\*Last validated:\*\*/.test(headerBlock) ||
      /Last reviewed:/.test(headerBlock);

    if (!hasFreshnessMarker) continue;
    hasFreshness++;

    const hasStatusBadge = />\s*\*\*Status:\*\*/.test(headerBlock);
    if (hasStatusBadge) {
      hasStatus++;
    } else {
      error(`${relPath}: has freshness marker but no "> **Status:** …" badge.`);
      missing++;
    }
  }

  if (missing === 0 && hasFreshness > 0) {
    ok(`All ${hasFreshness} docs with freshness markers have Status: badges.`);
  } else {
    console.log(
      `   ${hasStatus}/${hasFreshness} docs with freshness have Status badges (${missing} missing).`,
    );
  }
}

// ── Check 3: Dangling source refs ────────────────────────────────────────────

function checkDanglingRefs() {
  console.log("\n── Check 3: Dangling source refs in docs ──\n");

  const mdFiles = findMdFiles(ROOT);
  // Only check docs/ folder and root .md files
  const docsFiles = mdFiles.filter((f) => {
    const rel = relative(ROOT, f);
    return (
      rel.startsWith("docs/") ||
      [
        "AGENTS.md",
        "CONTRIBUTING.md",
        "CLAUDE.md",
        "DEVIN.md",
        "README.md",
      ].includes(rel)
    );
  });

  // Regex to find inline code refs like `apps/...` or `packages/...` or `scripts/...`
  const refRe =
    /`((?:apps|packages|scripts)\/[^`\s]+\.(?:ts|tsx|js|jsx|mjs|cjs|sql|json))`/g;

  let totalRefs = 0;
  let danglingRefs = 0;
  const danglingByFile = new Map();

  for (const file of docsFiles) {
    const relPath = relative(ROOT, file);
    const content = readFileSync(file, "utf-8");

    // Check if this is a "proposed" ADR (future refs are OK)
    if (
      relPath.startsWith("docs/adr/") &&
      /Status:\*?\*?\s*proposed/i.test(content)
    ) {
      continue;
    }

    // Check if this is the RN migration tracker (target-state refs are OK)
    if (relPath.includes("react-native-migration")) continue;

    // Pattern refs contain template placeholders (<domain>, <module>, *, {…})
    // or glob syntax — these are illustrative, not real file paths.
    const templateRe = /[<>*{}]/;

    let refMatch;
    while ((refMatch = refRe.exec(content)) !== null) {
      totalRefs++;
      const refPath = refMatch[1];

      // Skip template / glob refs — they are illustrative patterns, not real paths
      if (templateRe.test(refPath)) continue;

      const absRef = resolve(ROOT, refPath);
      if (!existsSync(absRef)) {
        danglingRefs++;
        if (!danglingByFile.has(relPath)) {
          danglingByFile.set(relPath, []);
        }
        danglingByFile.get(relPath).push(refPath);
      }
    }
  }

  if (danglingRefs === 0) {
    ok(`All ${totalRefs} source refs in docs resolve to existing files.`);
  } else if (STRICT) {
    error(
      `${danglingRefs} of ${totalRefs} source refs in docs point to non-existent files (--strict mode):`,
    );
    for (const [doc, refs] of danglingByFile) {
      for (const ref of refs) {
        error(`  ${doc} → ${ref}`);
      }
    }
  } else {
    warn(
      `${danglingRefs} of ${totalRefs} source refs in docs point to non-existent files:`,
    );
    for (const [doc, refs] of danglingByFile) {
      for (const ref of refs) {
        warn(`  ${doc} → ${ref}`);
      }
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function findMdFiles(dir) {
  const results = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    if (entry.isDirectory()) {
      results.push(...findMdFiles(fullPath));
    } else if (entry.name.endsWith(".md")) {
      results.push(fullPath);
    }
  }
  return results;
}

// ── Main ─────────────────────────────────────────────────────────────────────

checkHardRulesSync();
checkStatusBadges();
checkDanglingRefs();

console.log("\n── Summary ──\n");
console.log(`Errors: ${errors}`);
console.log(`Warnings: ${warnings}`);

if (errors > 0) {
  console.error("\n💥 Governance sync check FAILED.\n");
  process.exit(1);
} else if (warnings > 0) {
  console.log("\n⚠️  Governance sync check passed with warnings.\n");
} else {
  console.log("\n✅ Governance sync check passed.\n");
}
