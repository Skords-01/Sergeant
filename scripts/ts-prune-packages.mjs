/**
 * Запускає ts-prune для кожного workspace-пакета з власним tsconfig.json.
 * Вивід — потенційно невикористані експорти (потрібна ручна перевірка: barrel-и, тести).
 * Knip на повному дереві в цьому репо давав OOM (oxc-parser); ts-prune — легший варіант.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const configs = [
  "packages/shared/tsconfig.json",
  "packages/routine-domain/tsconfig.json",
  "packages/nutrition-domain/tsconfig.json",
  "packages/fizruk-domain/tsconfig.json",
  "packages/insights/tsconfig.json",
  "packages/finyk-domain/tsconfig.json",
  "packages/api-client/tsconfig.json",
];

let failed = false;
for (const cfg of configs) {
  // Відносний шлях від root: ts-prune на Windows інакше подвоює cwd у -p.
  console.error(`\n=== ts-prune: ${cfg} ===\n`);
  const r = spawnSync("pnpm", ["exec", "ts-prune", "-p", cfg], {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (r.status !== 0) failed = true;
}

process.exit(failed ? 1 : 0);
