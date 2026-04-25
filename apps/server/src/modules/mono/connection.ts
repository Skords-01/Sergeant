import type { Request, Response } from "express";
import pool from "../../db.js";

type AuthedRequest = Request & { user?: { id: string } };

/**
 * POST /api/mono/connect — connect Monobank token.
 * Stub: returns 501 until Track A PR2 implementation.
 */
export async function connectHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  res.status(501).json({ error: "Not implemented" });
}

/**
 * POST /api/mono/disconnect — disconnect Monobank.
 * Stub: returns 501 until Track A PR2 implementation.
 */
export async function disconnectHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  res.status(501).json({ error: "Not implemented" });
}

/**
 * GET /api/mono/sync-state — returns connection status, webhook state,
 * last event/backfill timestamps, and account count from DB.
 */
export async function syncStateHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const userId = (req as AuthedRequest).user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const connResult = await pool.query(
    `SELECT
       status,
       webhook_registered_at,
       last_event_at,
       last_backfill_at
     FROM mono_connection
     WHERE user_id = $1`,
    [userId],
  );

  if (connResult.rows.length === 0) {
    res.json({
      status: "disconnected",
      webhookActive: false,
      lastEventAt: null,
      lastBackfillAt: null,
      accountsCount: 0,
    });
    return;
  }

  const conn = connResult.rows[0];

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM mono_account WHERE user_id = $1`,
    [userId],
  );

  const toIso = (v: unknown): string | null =>
    v instanceof Date ? v.toISOString() : ((v as string | null) ?? null);

  res.json({
    status: conn.status,
    webhookActive: conn.webhook_registered_at != null,
    lastEventAt: toIso(conn.last_event_at),
    lastBackfillAt: toIso(conn.last_backfill_at),
    accountsCount: countResult.rows[0]?.cnt ?? 0,
  });
}
