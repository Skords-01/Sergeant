#!/usr/bin/env node
/**
 * Standalone database migration runner.
 *
 * Історія. Раніше `ensureSchema()` викликався з `server/index.js` при кожному
 * старті web-процесу. На rolling deploy з двома і більше реплік це давало:
 *   - race при `INSERT schema_migrations` (один інстанс програє й упаде),
 *   - або напіврозкочану міграцію, якщо вона довга і другий інстанс приходить
 *     під час виконання,
 *   - затримку readiness-проба пропорційну часу міграції.
 *
 * Правильна модель — Release-stage: цей скрипт запускається окремим job-ом
 * (на Railway це pre-deploy command, на Replit — вручну), перед тим як нові
 * інстанси server-а почнуть приймати трафік. Web-процес на старті більше
 * НЕ виконує міграції.
 *
 * Вихідні коди: 0 — все ок, 1 — будь-яка помилка (DATABASE_URL відсутній,
 * міграція впала, pg недоступний тощо).
 */
import { ensureSchema, pool } from "../server/db.js";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error(
      JSON.stringify({
        level: "error",
        msg: "migrate_database_url_missing",
      }),
    );
    process.exit(1);
  }

  const startedAt = Date.now();
  try {
    await ensureSchema();
    console.log(
      JSON.stringify({
        level: "info",
        msg: "migrate_ok",
        durationMs: Date.now() - startedAt,
      }),
    );
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        msg: "migrate_failed",
        durationMs: Date.now() - startedAt,
        err: {
          message: err?.message || String(err),
          code: err?.code,
        },
      }),
    );
    process.exitCode = 1;
  } finally {
    // `pool.end()` обов'язковий: без нього процес Node триматиме pg-з'єднання
    // відкритим і не вийде, а release-job зависне по timeout-у.
    try {
      await pool.end();
    } catch {
      /* best-effort */
    }
  }
}

main().catch((err) => {
  console.error(
    JSON.stringify({
      level: "error",
      msg: "migrate_unhandled",
      err: { message: err?.message || String(err) },
    }),
  );
  process.exit(1);
});
