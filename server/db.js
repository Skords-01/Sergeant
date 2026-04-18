import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { logger } from "./obs/logger.js";
import {
  dbErrorsTotal,
  dbQueryDurationMs,
  dbSlowQueriesTotal,
} from "./obs/metrics.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
});

pool.on("error", (err) => {
  logger.error({
    msg: "db_pool_error",
    err: { message: err?.message || String(err), code: err?.code },
  });
  try {
    dbErrorsTotal.inc({ code: err?.code || "unknown" });
  } catch {
    /* ignore */
  }
});

const SLOW_MS = Number(process.env.DB_SLOW_MS) || 200;

/** Коротке ім'я SQL для логів (перше слово + перші 120 символів, без параметрів). */
function sqlSummary(text) {
  if (typeof text !== "string") return undefined;
  return text.replace(/\s+/g, " ").trim().slice(0, 120);
}

/**
 * Обгортка над `pool.query` з логуванням повільних запитів, метриками і
 * підрахунком помилок. Підпис збережено один-в-один з pg, щоб можна було
 * поступово переводити handler-и без зміни викликів.
 *
 * @param {string | { text: string, values?: unknown[] }} text
 * @param {unknown[]} [values]
 * @param {{ op?: string }} [meta]
 */
export async function query(text, values, meta) {
  const op = meta?.op ?? "query";
  const start = process.hrtime.bigint();
  try {
    const result = await pool.query(text, values);
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
        sql: sqlSummary(typeof text === "string" ? text : text?.text),
        ms: Math.round(ms),
        rows: result.rowCount,
      });
    }
    return result;
  } catch (err) {
    try {
      dbErrorsTotal.inc({ code: err?.code || "unknown" });
    } catch {
      /* ignore */
    }
    logger.error({
      msg: "db_error",
      op,
      sql: sqlSummary(typeof text === "string" ? text : text?.text),
      err: { message: err?.message || String(err), code: err?.code },
    });
    throw err;
  }
}

async function ensureAuthTables(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "user" (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      "emailVerified" BOOLEAN NOT NULL DEFAULT FALSE,
      image TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS session (
      id TEXT PRIMARY KEY,
      "expiresAt" TIMESTAMPTZ NOT NULL,
      token TEXT NOT NULL UNIQUE,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "ipAddress" TEXT,
      "userAgent" TEXT,
      "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS account (
      id TEXT PRIMARY KEY,
      "accountId" TEXT NOT NULL,
      "providerId" TEXT NOT NULL,
      "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      "accessToken" TEXT,
      "refreshToken" TEXT,
      "idToken" TEXT,
      "accessTokenExpiresAt" TIMESTAMPTZ,
      "refreshTokenExpiresAt" TIMESTAMPTZ,
      scope TEXT,
      password TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS verification (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL,
      value TEXT NOT NULL,
      "expiresAt" TIMESTAMPTZ NOT NULL,
      "createdAt" TIMESTAMPTZ DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

/**
 * Incremental SQL migrations from server/migrations/*.sql (lexicographic order).
 * Tracked in schema_migrations. Baseline DDL stays in ensureSchema (idempotent CREATE IF NOT EXISTS).
 */
async function runPendingSqlMigrations(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const migrationsDir = path.join(__dirname, "migrations");
  let files;
  try {
    files = await fs.readdir(migrationsDir);
  } catch (e) {
    if (e?.code === "ENOENT") return;
    throw e;
  }

  const sqlFiles = files.filter((f) => f.endsWith(".sql")).sort();
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
      console.log(`[db] Migration applied: ${file}`);
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
  }
}

export async function ensureSchema() {
  const client = await pool.connect();
  try {
    await ensureAuthTables(client);
    await client.query(`
      CREATE TABLE IF NOT EXISTS module_data (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        module TEXT NOT NULL,
        data JSONB NOT NULL DEFAULT '{}',
        version INTEGER NOT NULL DEFAULT 1,
        client_updated_at TIMESTAMPTZ DEFAULT NOW(),
        server_updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, module)
      )
    `);
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_module_data_user ON module_data(user_id)`,
    );
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE module_data ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
      EXCEPTION WHEN duplicate_column THEN NULL;
      END $$
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL UNIQUE,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id)`,
    );

    await runPendingSqlMigrations(client);
  } finally {
    client.release();
  }
}

export { pool };
export default pool;
