import pool from "../db.js";
import { getSessionUser } from "../auth.js";
import { logger } from "../obs/logger.js";
import { setRequestModule } from "../obs/requestContext.js";
import {
  syncConflictsTotal,
  syncDurationMs,
  syncOperationsTotal,
  syncPayloadBytes,
} from "../obs/metrics.js";

function recordConflict(module) {
  try {
    syncConflictsTotal.inc({ module });
  } catch {
    /* ignore */
  }
}

/**
 * Спільно: метрика + structured `sync_event` лог. Карта outcome→level:
 *   ok | empty                         → info
 *   conflict | invalid | too_large | unauthorized → warn
 *   error                              → error
 *
 * `extra` — довільні JSON-поля для тріажу (версії, timestamp-и). requestId,
 * userId, module підтягуються з ALS у Pino `mixin()` автоматично — не дублюй.
 *
 * Query pattern (Loki/Railway):
 *   {service="sergeant-api"} | json | msg="sync_event" | outcome="conflict" | module="routine"
 */
function recordSync(op, module, outcome, { ms, bytes, extra } = {}) {
  try {
    syncOperationsTotal.inc({ op, module, outcome });
    if (ms != null) syncDurationMs.observe({ op, module }, ms);
    if (bytes != null) syncPayloadBytes.observe({ op, module }, bytes);
  } catch {
    /* metrics must never break a request */
  }
  const level =
    outcome === "error"
      ? "error"
      : outcome === "conflict" ||
          outcome === "invalid" ||
          outcome === "too_large" ||
          outcome === "unauthorized"
        ? "warn"
        : "info";
  try {
    logger[level]({
      msg: "sync_event",
      op,
      module,
      outcome,
      ms: ms != null ? Math.round(ms) : undefined,
      bytes,
      ...(extra || {}),
    });
  } catch {
    /* logging must never break a request */
  }
}

function elapsedMs(start) {
  return Number(process.hrtime.bigint() - start) / 1e6;
}

const VALID_MODULES = new Set(["finyk", "fizruk", "routine", "nutrition"]);
const MAX_BLOB_SIZE = 5 * 1024 * 1024;

export async function syncPush(req, res) {
  setRequestModule("sync");
  const start = process.hrtime.bigint();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await getSessionUser(req);
  if (!user) {
    recordSync("push", "unknown", "unauthorized", { ms: elapsedMs(start) });
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { module, data, clientUpdatedAt } = req.body || {};

  if (!module || !VALID_MODULES.has(module)) {
    recordSync("push", module || "unknown", "invalid", {
      ms: elapsedMs(start),
    });
    return res.status(400).json({ error: "Invalid module" });
  }

  if (data === undefined || data === null) {
    recordSync("push", module, "invalid", { ms: elapsedMs(start) });
    return res.status(400).json({ error: "Missing data" });
  }

  const blob = JSON.stringify(data);
  if (blob.length > MAX_BLOB_SIZE) {
    recordSync("push", module, "too_large", {
      ms: elapsedMs(start),
      bytes: blob.length,
    });
    return res.status(413).json({ error: "Data too large" });
  }

  const clientTs = clientUpdatedAt ? new Date(clientUpdatedAt) : new Date();

  try {
    const result = await pool.query(
      `INSERT INTO module_data (user_id, module, data, client_updated_at, version)
       VALUES ($1, $2, $3, $4, 1)
       ON CONFLICT (user_id, module) DO UPDATE
         SET data = $3, client_updated_at = $4, server_updated_at = NOW(),
             version = module_data.version + 1
       WHERE module_data.client_updated_at <= $4
       RETURNING server_updated_at, version`,
      [user.id, module, blob, clientTs],
    );

    if (result.rows.length === 0) {
      const existing = await pool.query(
        `SELECT server_updated_at, version FROM module_data WHERE user_id = $1 AND module = $2`,
        [user.id, module],
      );
      recordConflict(module);
      recordSync("push", module, "conflict", {
        ms: elapsedMs(start),
        bytes: blob.length,
        extra: {
          clientUpdatedAt: clientTs.toISOString(),
          serverUpdatedAt: existing.rows[0]?.server_updated_at,
          serverVersion: existing.rows[0]?.version ?? 0,
        },
      });
      return res.json({
        ok: true,
        module,
        conflict: true,
        serverUpdatedAt: existing.rows[0]?.server_updated_at,
        version: existing.rows[0]?.version ?? 0,
      });
    }

    recordSync("push", module, "ok", {
      ms: elapsedMs(start),
      bytes: blob.length,
    });
    return res.json({
      ok: true,
      module,
      serverUpdatedAt: result.rows[0].server_updated_at,
      version: result.rows[0].version,
    });
  } catch (e) {
    recordSync("push", module, "error", {
      ms: elapsedMs(start),
      bytes: blob.length,
    });
    throw e;
  }
}

export async function syncPull(req, res) {
  setRequestModule("sync");
  const start = process.hrtime.bigint();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await getSessionUser(req);
  if (!user) {
    recordSync("pull", "unknown", "unauthorized", { ms: elapsedMs(start) });
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { module } = req.body || {};

  if (!module || !VALID_MODULES.has(module)) {
    recordSync("pull", module || "unknown", "invalid", {
      ms: elapsedMs(start),
    });
    return res.status(400).json({ error: "Invalid module" });
  }

  try {
    const result = await pool.query(
      `SELECT data, client_updated_at, server_updated_at, version
       FROM module_data
       WHERE user_id = $1 AND module = $2`,
      [user.id, module],
    );

    if (result.rows.length === 0) {
      recordSync("pull", module, "empty", { ms: elapsedMs(start) });
      return res.json({
        ok: true,
        module,
        data: null,
        serverUpdatedAt: null,
        version: 0,
      });
    }

    const row = result.rows[0];
    let data;
    try {
      data = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
    } catch {
      data = row.data;
    }

    const bytes =
      typeof row.data === "string"
        ? row.data.length
        : row.data != null
          ? JSON.stringify(row.data).length
          : 0;
    recordSync("pull", module, "ok", { ms: elapsedMs(start), bytes });

    return res.json({
      ok: true,
      module,
      data,
      clientUpdatedAt: row.client_updated_at,
      serverUpdatedAt: row.server_updated_at,
      version: row.version,
    });
  } catch (e) {
    recordSync("pull", module, "error", { ms: elapsedMs(start) });
    throw e;
  }
}

export async function syncPullAll(req, res) {
  setRequestModule("sync");
  const start = process.hrtime.bigint();
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await getSessionUser(req);
  if (!user) {
    recordSync("pull_all", "all", "unauthorized", { ms: elapsedMs(start) });
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const result = await pool.query(
      `SELECT module, data, client_updated_at, server_updated_at, version
       FROM module_data
       WHERE user_id = $1`,
      [user.id],
    );

    const modules = {};
    for (const row of result.rows) {
      let data;
      try {
        data = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
      } catch {
        data = row.data;
      }
      modules[row.module] = {
        data,
        clientUpdatedAt: row.client_updated_at,
        serverUpdatedAt: row.server_updated_at,
        version: row.version,
      };
    }

    recordSync("pull_all", "all", "ok", { ms: elapsedMs(start) });
    return res.json({ ok: true, modules });
  } catch (e) {
    recordSync("pull_all", "all", "error", { ms: elapsedMs(start) });
    throw e;
  }
}

export async function syncPushAll(req, res) {
  setRequestModule("sync");
  const start = process.hrtime.bigint();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await getSessionUser(req);
  if (!user) {
    recordSync("push_all", "all", "unauthorized", { ms: elapsedMs(start) });
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { modules } = req.body || {};
  if (!modules || typeof modules !== "object") {
    recordSync("push_all", "all", "invalid", { ms: elapsedMs(start) });
    return res.status(400).json({ error: "Missing modules object" });
  }

  const results = {};
  // Per-module метрики `push` накопичуємо тут і емітимо ЛИШЕ після COMMIT.
  // Якщо один із модулів посеред транзакції кине — `ROLLBACK` відкотить
  // уже «успішні» INSERT-и, але лічильник `sync_operations_total{outcome="ok"}`
  // уже був би інкрементований → SLI бреше, `SyncErrorBudgetBurn` пропускає
  // реальні збої. `too_large` — виняток: це per-item reject ДО будь-якого
  // DML, тому rollback його не зачіпає, фіксуємо одразу.
  const pending = [];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const [mod, payload] of Object.entries(modules)) {
      if (!VALID_MODULES.has(mod)) continue;
      const { data, clientUpdatedAt } = payload || {};
      if (data === undefined || data === null) continue;
      const blob = JSON.stringify(data);
      if (blob.length > MAX_BLOB_SIZE) {
        recordSync("push", mod, "too_large", { bytes: blob.length });
        results[mod] = { ok: false, error: "Too large" };
        continue;
      }
      const clientTs = clientUpdatedAt ? new Date(clientUpdatedAt) : new Date();
      const r = await client.query(
        `INSERT INTO module_data (user_id, module, data, client_updated_at, version)
         VALUES ($1, $2, $3, $4, 1)
         ON CONFLICT (user_id, module) DO UPDATE
           SET data = $3, client_updated_at = $4, server_updated_at = NOW(),
               version = module_data.version + 1
         WHERE module_data.client_updated_at <= $4
         RETURNING server_updated_at, version`,
        [user.id, mod, blob, clientTs],
      );
      if (r.rows.length === 0) {
        const existing = await client.query(
          `SELECT server_updated_at, version FROM module_data WHERE user_id = $1 AND module = $2`,
          [user.id, mod],
        );
        pending.push({ module: mod, outcome: "conflict", bytes: blob.length });
        results[mod] = {
          ok: true,
          conflict: true,
          serverUpdatedAt: existing.rows[0]?.server_updated_at,
          version: existing.rows[0]?.version ?? 0,
        };
      } else {
        pending.push({ module: mod, outcome: "ok", bytes: blob.length });
        results[mod] = {
          ok: true,
          serverUpdatedAt: r.rows[0].server_updated_at,
          version: r.rows[0].version,
        };
      }
    }
    await client.query("COMMIT");
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore secondary rollback failure — original error matters more */
    }
    // Все, що «встигло» в pending — насправді відкотилося. Перекласифікуй
    // як error, щоб метрики відображали реальний стан БД.
    for (const p of pending) {
      recordSync("push", p.module, "error", { bytes: p.bytes });
    }
    recordSync("push_all", "all", "error", { ms: elapsedMs(start) });
    throw err;
  } finally {
    client.release();
  }

  for (const p of pending) {
    if (p.outcome === "conflict") recordConflict(p.module);
    recordSync("push", p.module, p.outcome, { bytes: p.bytes });
  }
  recordSync("push_all", "all", "ok", { ms: elapsedMs(start) });
  return res.json({ ok: true, results });
}
