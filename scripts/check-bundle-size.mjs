#!/usr/bin/env node
/**
 * Bundle size guard — runs after `vite build`.
 *
 * Reads dist/assets/*.js, prints a size table, and exits with code 1 if any
 * limit is exceeded. Adjust the thresholds below when the bundle intentionally
 * grows (e.g. a new large dependency is added deliberately).
 *
 * Usage:
 *   node scripts/check-bundle-size.mjs
 */

import { readdirSync, statSync } from "fs";
import { join, extname } from "path";

// ─── Thresholds ───────────────────────────────────────────────────────────────

/** Maximum size (bytes, uncompressed) for a single JS chunk. */
const MAX_CHUNK_BYTES = 600_000; // 600 KB

/** Maximum total size (bytes, uncompressed) for all JS chunks combined. */
const MAX_TOTAL_BYTES = 4_000_000; // 4 MB

// ─────────────────────────────────────────────────────────────────────────────

const DIST_ASSETS = join(process.cwd(), "dist", "assets");

function readJsFiles(dir) {
  try {
    return readdirSync(dir)
      .filter((f) => extname(f) === ".js")
      .map((f) => {
        const full = join(dir, f);
        const { size } = statSync(full);
        return { name: f, size };
      })
      .sort((a, b) => b.size - a.size);
  } catch {
    console.error(
      `[bundle-size] Cannot read ${dir} — did you run 'npm run build' first?`,
    );
    process.exit(1);
  }
}

function fmt(bytes) {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(2)} MB`;
  return `${(bytes / 1_000).toFixed(1)} KB`;
}

const files = readJsFiles(DIST_ASSETS);
const totalBytes = files.reduce((s, f) => s + f.size, 0);

// Print table
const nameWidth = Math.max(20, ...files.map((f) => f.name.length));
console.log("\n📦 Bundle size report\n");
console.log(`${"Chunk".padEnd(nameWidth)}  Size          Limit`);
console.log("─".repeat(nameWidth + 30));

let violations = 0;

for (const { name, size } of files) {
  const over = size > MAX_CHUNK_BYTES;
  if (over) violations++;
  const flag = over ? " ❌ OVER LIMIT" : "";
  console.log(
    `${name.padEnd(nameWidth)}  ${fmt(size).padStart(9)}    (limit ${fmt(MAX_CHUNK_BYTES)})${flag}`,
  );
}

console.log("─".repeat(nameWidth + 30));
const totalOver = totalBytes > MAX_TOTAL_BYTES;
if (totalOver) violations++;
console.log(
  `${"TOTAL".padEnd(nameWidth)}  ${fmt(totalBytes).padStart(9)}    (limit ${fmt(MAX_TOTAL_BYTES)})${totalOver ? " ❌ OVER LIMIT" : ""}`,
);
console.log();

if (violations > 0) {
  console.error(
    `[bundle-size] ❌ ${violations} limit(s) exceeded. ` +
      `Optimise the bundle or raise the thresholds in scripts/check-bundle-size.mjs.\n`,
  );
  process.exit(1);
}

console.log("[bundle-size] ✅ All chunks within limits.\n");
