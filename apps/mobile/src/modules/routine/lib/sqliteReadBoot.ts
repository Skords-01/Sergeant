/**
 * Boot wiring for the mobile SQLite read path.
 *
 * Stage 8 PR #055r2 of `docs/planning/storage-roadmap.md`. When
 * `feature.routine.sqlite_v2.read_sqlite` is on, this warms the
 * `routine_entries` completion cache and flips `loadRoutineState()` to
 * overlay completions from SQLite while the rest of Routine still reads
 * from MMKV.
 */

import { getSqliteMigrationClient } from "@/core/db/sqlite";
import { getFlag } from "@/core/lib/featureFlags";

import { migrateRoutine } from "./clientMigrate";
import { setSqliteReadEnabled } from "./routineStore";
import { refreshSqliteCompletions } from "./sqliteReader";

const FLAG_ID = "feature.routine.sqlite_v2.read_sqlite";

let booted = false;

export async function bootSqliteReadPath(
  userId: string | null,
): Promise<boolean> {
  if (booted) return false;

  const enabled = getFlag(FLAG_ID);
  if (!enabled || !userId) {
    setSqliteReadEnabled(false);
    return false;
  }

  try {
    const client = await getSqliteMigrationClient();
    await migrateRoutine(client);
    await refreshSqliteCompletions(client, userId);

    setSqliteReadEnabled(true);
    booted = true;
    return true;
  } catch (err) {
    console.warn(
      "[routine.sqliteRead] boot failed, falling back to MMKV",
      err instanceof Error ? err.message : err,
    );
    setSqliteReadEnabled(false);
    return false;
  }
}

export function __resetSqliteReadBootForTests(): void {
  booted = false;
}
