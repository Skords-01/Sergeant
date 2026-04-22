#!/usr/bin/env node
/**
 * Regenerates `THIRD_PARTY_LICENSES.md` from the current production
 * dependency tree of `@sergeant/web` and `@sergeant/server` — the two
 * workspaces that actually ship to end users (Vercel build artefacts +
 * Railway-served Express runtime).
 *
 * How it works:
 *   1. Invokes `pnpm --filter @sergeant/web --filter @sergeant/server
 *      licenses list --prod --json` to get every installed package's
 *      declared license.
 *   2. Filters out packages in the `DEV_*` lists below. These are
 *      compile-time / test-time tooling that pnpm pulls in through
 *      workspace peer dependencies (most notably `@better-auth/expo`
 *      → `expo-constants` → `expo` → `babel-preset-expo` → the entire
 *      RN/Babel/Metro toolchain) but that never end up in either the
 *      Vite-built browser bundle or the Node-side Express runtime.
 *      Keeping them would triple the file with false positives that
 *      are never shipped.
 *   3. Writes a sorted, de-duplicated Markdown list to the repo root
 *      matching the historical format:
 *          - [<pkg>@<version>](<homepage>) - <license>
 *
 * Run from the repo root:
 *   pnpm licenses:gen
 *
 * The resulting diff should be committed verbatim.
 */
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(__dirname, "..");
const outPath = resolve(repoRoot, "THIRD_PARTY_LICENSES.md");

// Our own workspace packages — never listed in the SBOM.
const WORKSPACE_EXACT = new Set([
  "sergeant",
  "@sergeant/web",
  "@sergeant/server",
  "@sergeant/shared",
  "@sergeant/api-client",
  "@sergeant/config",
  "@sergeant/mobile",
  "@sergeant/mobile-shell",
  "@sergeant/finyk-domain",
  "@sergeant/fizruk-domain",
  "@sergeant/routine-domain",
  "eslint-plugin-sergeant-design",
]);

// Build/test tooling pulled through peer chains but never shipped.
// Order roughly by chain: TS type-only, Babel/Metro/RN (Expo chain),
// test runners, bundlers, linters, monorepo tooling, DevTools, Detox,
// Sentry internals.
const DEV_PREFIXES = [
  "@types/",
  "@typescript-eslint/",
  "@babel/",
  "babel-plugin-",
  "babel-preset-",
  "babel-",
  "@react-native/",
  "@react-native-community/",
  "@react-native-async-storage/",
  "react-native",
  "react-devtools",
  "@expo/cli",
  "@expo/config",
  "@expo/dev",
  "@expo/env",
  "@expo/json",
  "@expo/logger",
  "@expo/metro",
  "@expo/package-manager",
  "@expo/plist",
  "@expo/prebuild-config",
  "@expo/rudder",
  "@expo/sdk-runtime",
  "@expo/spawn-async",
  "@expo/vector-icons",
  "@expo/xcpretty",
  "expo-",
  "metro",
  "@jest/",
  "jest-",
  "@testing-library/",
  "@vitest/",
  "@rollup/",
  "@vitejs/",
  "@swc/",
  "@esbuild/",
  "@eslint/",
  "eslint-plugin-",
  "eslint-config-",
  "eslint-",
  "@detox/",
  "detox",
  "@sentry-internal/",
  "@npmcli/",
  "@pnpm/",
];

const DEV_EXACT = new Set([
  "jest",
  "vitest",
  "rollup",
  "vite",
  "typescript",
  "esbuild",
  "eslint",
  "prettier",
  "expo",
  "tsx",
  "turbo",
  "husky",
  "lint-staged",
  "nodemon",
  "babel-jest",
  "babel-core",
  "flow-bin",
  "flow-parser",
  "jsc-android",
  "hermes-engine",
  "react-devtools-core",
  "react-native-worklets",
]);

function isDev(name) {
  if (WORKSPACE_EXACT.has(name) || DEV_EXACT.has(name)) return true;
  for (const p of DEV_PREFIXES) if (name.startsWith(p)) return true;
  return false;
}

function run() {
  const result = spawnSync(
    "pnpm",
    [
      "--filter",
      "@sergeant/web",
      "--filter",
      "@sergeant/server",
      "licenses",
      "list",
      "--prod",
      "--json",
    ],
    { cwd: repoRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  if (result.status !== 0) {
    process.stderr.write(result.stderr || "pnpm licenses list failed\n");
    process.exit(result.status ?? 1);
  }
  return JSON.parse(result.stdout);
}

function main() {
  const data = run();
  const rows = [];
  for (const [license, pkgs] of Object.entries(data)) {
    for (const pkg of pkgs) {
      if (!pkg.name || isDev(pkg.name)) continue;
      const versions =
        Array.isArray(pkg.versions) && pkg.versions.length
          ? pkg.versions
          : [pkg.version].filter(Boolean);
      for (const version of versions) {
        rows.push({
          name: pkg.name,
          version,
          license,
          homepage: pkg.homepage || "undefined",
        });
      }
    }
  }
  rows.sort(
    (a, b) =>
      a.name.localeCompare(b.name) || a.version.localeCompare(b.version),
  );
  const seen = new Set();
  const lines = [];
  for (const r of rows) {
    const key = `${r.name}@${r.version}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(`- [${r.name}@${r.version}](${r.homepage}) - ${r.license}`);
  }
  writeFileSync(outPath, lines.join("\n") + "\n", "utf8");
  process.stdout.write(`Wrote ${lines.length} entries to ${outPath}\n`);
}

main();
