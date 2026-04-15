import pool from "../db.js";
import { getSessionUser } from "../auth.js";

const VALID_MODULES = new Set(["finyk", "fizruk", "routine", "nutrition"]);
const MAX_BLOB_SIZE = 5 * 1024 * 1024;

export async function syncPush(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await getSessionUser(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { module, data, clientUpdatedAt } = req.body || {};

  if (!module || !VALID_MODULES.has(module)) {
    return res.status(400).json({ error: "Invalid module" });
  }

  if (data === undefined || data === null) {
    return res.status(400).json({ error: "Missing data" });
  }

  const blob = JSON.stringify(data);
  if (blob.length > MAX_BLOB_SIZE) {
    return res.status(413).json({ error: "Data too large" });
  }

  const clientTs = clientUpdatedAt ? new Date(clientUpdatedAt) : new Date();

  const result = await pool.query(
    `INSERT INTO module_data (user_id, module, data, client_updated_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, module) DO UPDATE
       SET data = $3, client_updated_at = $4, server_updated_at = NOW()
     RETURNING server_updated_at`,
    [user.id, module, blob, clientTs],
  );

  return res.json({
    ok: true,
    module,
    serverUpdatedAt: result.rows[0].server_updated_at,
  });
}

export async function syncPull(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await getSessionUser(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { module } = req.body || {};

  if (!module || !VALID_MODULES.has(module)) {
    return res.status(400).json({ error: "Invalid module" });
  }

  const result = await pool.query(
    `SELECT data, client_updated_at, server_updated_at
     FROM module_data
     WHERE user_id = $1 AND module = $2`,
    [user.id, module],
  );

  if (result.rows.length === 0) {
    return res.json({ ok: true, module, data: null, serverUpdatedAt: null });
  }

  const row = result.rows[0];
  let data;
  try {
    data = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
  } catch {
    data = row.data;
  }

  return res.json({
    ok: true,
    module,
    data,
    clientUpdatedAt: row.client_updated_at,
    serverUpdatedAt: row.server_updated_at,
  });
}

export async function syncPullAll(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await getSessionUser(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const result = await pool.query(
    `SELECT module, data, client_updated_at, server_updated_at
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
    };
  }

  return res.json({ ok: true, modules });
}

export async function syncPushAll(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await getSessionUser(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { modules } = req.body || {};
  if (!modules || typeof modules !== "object") {
    return res.status(400).json({ error: "Missing modules object" });
  }

  const results = {};
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const [mod, payload] of Object.entries(modules)) {
      if (!VALID_MODULES.has(mod)) continue;
      const { data, clientUpdatedAt } = payload || {};
      if (data === undefined || data === null) continue;
      const blob = JSON.stringify(data);
      if (blob.length > MAX_BLOB_SIZE) {
        results[mod] = { ok: false, error: "Too large" };
        continue;
      }
      const clientTs = clientUpdatedAt
        ? new Date(clientUpdatedAt)
        : new Date();
      const r = await client.query(
        `INSERT INTO module_data (user_id, module, data, client_updated_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, module) DO UPDATE
           SET data = $3, client_updated_at = $4, server_updated_at = NOW()
         RETURNING server_updated_at`,
        [user.id, mod, blob, clientTs],
      );
      results[mod] = { ok: true, serverUpdatedAt: r.rows[0].server_updated_at };
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return res.json({ ok: true, results });
}
