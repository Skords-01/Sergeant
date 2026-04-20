import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import type { PoolClient, QueryResult, QueryResultRow } from "pg";
import { logger } from "./obs/logger.js";
import {
  dbErrorsTotal,
  dbQueryDurationMs,
  dbSlowQueriesTotal,
} from "./obs/metrics.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Максимум активних клієнтів у пулі. На Railway Hobby-інстансі з ~512MB
 * пам'яті та одним vCPU 10 — розумний baseline, але під пікове навантаження
 * або після bump-у плану хочеться підняти без релізу коду. Ставиться через
 * `PG_POOL_MAX`; Postgres-сторона (`max_connections`) лишається єдиним
 * жорстким лімітом — значення вище за неї просто призведе до conn-помилок.
 */
const PG_POOL_MAX = Number(process.env.PG_POOL_MAX) || 10;

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: PG_POOL_MAX,
  idleTimeoutMillis: 30_000,
});

interface PgErrorLike {
  message?: string;
  code?: string;
}

function pgErr(err: unknown): PgErrorLike {
  return (err && typeof err === "object" ? (err as PgErrorLike) : {}) ?? {};
}

pool.on("error", (err: Error) => {
  const e = pgErr(err);
  logger.error({
    msg: "db_pool_error",
    err: { message: e.message || String(err), code: e.code },
  });
  try {
    dbErrorsTotal.inc({ code: e.code || "unknown" });
  } catch {
    /* ignore */
  }
});

const SLOW_MS = Number(process.env.DB_SLOW_MS) || 200;

type QueryText = string | { text: string; values?: unknown[] };

interface QueryMeta {
  op?: string;
}

/** Коротке ім'я SQL для логів (перше слово + перші 120 символів, без параметрів). */
function sqlSummary(text: unknown): string | undefined {
  if (typeof text !== "string") return undefined;
  return text.replace(/\s+/g, " ").trim().slice(0, 120);
}

/**
 * Обгортка над `pool.query` з логуванням повільних запитів, метриками і
 * підрахунком помилок. Підпис збережено один-в-один з pg, щоб можна було
 * поступово переводити handler-и без зміни викликів.
 */
export async function query<R extends QueryResultRow = QueryResultRow>(
  text: QueryText,
  values?: unknown[],
  meta?: QueryMeta,
): Promise<QueryResult<R>> {
  const op = meta?.op ?? "query";
  const start = process.hrtime.bigint();
  const sqlText = typeof text === "string" ? text : text.text;
  try {
    const result = await pool.query<R>(
      sqlText,
      values as unknown[] | undefined,
    );
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    try {
      dbQueryDurationMs.observe({ op }, ms);
    } catch {
      /* ignore */
    }
    if (ms >= SLOW_MS) {
      try {
        dbSlowQueriesTotal.inc({ op });
      } catch {
        /* ignore */
      }
      logger.warn({
        msg: "db_slow",
        op,
        sql: sqlSummary(sqlText),
        ms: Math.round(ms),
        rows: result.rowCount,
      });
    }
    return result;
  } catch (err: unknown) {
    const e = pgErr(err);
    try {
      dbErrorsTotal.inc({ code: e.code || "unknown" });
    } catch {
      /* ignore */
    }
    logger.error({
      msg: "db_error",
      op,
      sql: sqlSummary(sqlText),
      err: { message: e.message || String(err), code: e.code },
    });
    throw err;
  }
}

/**
 * Стабільний 64-бітний id для advisory-lock міграцій. Значення — статичне,
 * довільне, ключ — щоб два процеси `scripts/migrate.mjs` (паралельний
 * release-stage на різних репліках, ручний `npm run db:migrate` під час
 * деплою тощо) не стартували міграції одночасно й не зловили race на
 * `INSERT schema_migrations` або DDL-колізію. Lock session-scoped —
 * звільниться автоматично, якщо процес упаде.
 */
const MIGRATIONS_ADVISORY_LOCK_KEY = 7317483629462015n;

/**
 * Incremental SQL migrations from server/migrations/*.sql (lexicographic order).
 * Tracked in schema_migrations. schema_migrations itself is the only table
 * created inline — everything else is defined in migration files.
 *
 * `pg_advisory_lock` серіалізує паралельні виклики: другий claim буде
 * спати доти, доки перший не відпустить lock (у `ensureSchema.finally`).
 * Після розблокування другий увійде, побачить уже застосовані файли у
 * `schema_migrations` і тихо no-op-не.
 */
async function runPendingSqlMigrations(client: PoolClient): Promise<void> {
  await client.query("SELECT pg_advisory_lock($1)", [
    MIGRATIONS_ADVISORY_LOCK_KEY.toString(),
  ]);

  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const migrationsDir = path.join(__dirname, "migrations");
  let files: string[];
  try {
    files = await fs.readdir(migrationsDir);
  } catch (e: unknown) {
    if (pgErr(e).code === "ENOENT") return;
    throw e;
  }

  // Forward-only runner: `.down.sql` — явні rollback-скрипти, які DBA
  // запускає руками (див. коментар у відповідному файлі). Виключаємо їх з
  // auto-apply, інакше `006_push_devices.down.sql` відкотив би міграцію
  // одразу після її застосування.
  const sqlFiles = files
    .filter((f) => f.endsWith(".sql") && !f.endsWith(".down.sql"))
    .sort();
  for (const file of sqlFiles) {
    const { rows } = await client.query(
      "SELECT 1 AS ok FROM schema_migrations WHERE name = $1",
      [file],
    );
    if (rows.length > 0) continue;

    const fullPath = path.join(migrationsDir, file);
    const sql = (await fs.readFile(fullPath, "utf8")).trim();
    if (!sql) continue;

    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [
        file,
      ]);
      await client.query("COMMIT");
      logger.info({ msg: "migration_applied", file });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
  }
}

export async function ensureSchema(): Promise<void> {
  const client = await pool.connect();
  try {
    await runPendingSqlMigrations(client);
  } finally {
    // Best-effort відпускання advisory-lock. Якщо pg_advisory_lock ніколи
    // не викликався (наприклад, connect впав), unlock поверне false і не
    // кине. Release клієнта — окремо у finally, щоб lock не "зависнув"
    // поки pg не задетектить дропнуту сесію.
    try {
      await client.query("SELECT pg_advisory_unlock($1)", [
        MIGRATIONS_ADVISORY_LOCK_KEY.toString(),
      ]);
    } catch {
      /* сесія однаково release-ається нижче */
    }
    client.release();
  }
}

export { pool };
export default pool;
