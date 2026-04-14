import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, "..");

const vitestEntry = resolve(__dirname, "../node_modules/vitest/vitest.mjs");
const args = process.argv.slice(2);

function stripLocalstorageFlag(nodeOptionsRaw) {
  const raw = String(nodeOptionsRaw || "").trim();
  if (!raw) return raw;

  // Node parses NODE_OPTIONS similarly to a shell-style whitespace split.
  // We only need to remove `--localstorage-file` and its value (if provided).
  const parts = raw.split(/\s+/g).filter(Boolean);
  const out = [];

  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p === "--localstorage-file") {
      // also drop the next token if it's a value
      if (i + 1 < parts.length && !parts[i + 1].startsWith("--")) i++;
      continue;
    }
    if (p.startsWith("--localstorage-file=")) continue;
    out.push(p);
  }

  return out.join(" ");
}

const localStorageFile = resolve(__dirname, "../.vitest-localstorage.json");

const child = spawn(process.execPath, [vitestEntry, ...args], {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_OPTIONS: [
      stripLocalstorageFlag(process.env.NODE_OPTIONS),
      `--localstorage-file=${localStorageFile}`,
    ]
      .filter(Boolean)
      .join(" "),
  },
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});

