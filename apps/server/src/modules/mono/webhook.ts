import type { Request, Response } from "express";
import crypto from "node:crypto";
import { query } from "../../db.js";
import { logger } from "../../obs/logger.js";
import {
  monoWebhookReceivedTotal,
  monoWebhookDurationMs,
} from "../../obs/metrics.js";

/**
 * POST /api/mono/webhook/:secret — public Monobank delivery endpoint.
 *
 * Auth: path-based secret validated against `mono_connection.webhook_secret`
 * with timing-safe comparison. No session auth — Monobank calls this directly.
 *
 * Payload: `{ type: "StatementItem", data: { account, statementItem } }`.
 * Idempotent UPSERT by PK `(user_id, mono_tx_id)`.
 * Always returns 200 after successful write (Monobank retries on non-2xx).
 */

interface StatementItem {
  id: string;
  time: number;
  description: string;
  mcc: number;
  originalMcc?: number;
  hold?: boolean;
  amount: number;
  operationAmount: number;
  currencyCode: number;
  commissionRate?: number;
  cashbackAmount?: number;
  balance?: number;
  comment?: string;
  receiptId?: string;
  invoiceId?: string;
  counterEdrpou?: string;
  counterIban?: string;
  counterName?: string;
}

interface WebhookPayload {
  type: string;
  data: {
    account: string;
    statementItem: StatementItem;
  };
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function webhookHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const start = process.hrtime.bigint();
  const secret = req.params.secret;

  if (!secret || typeof secret !== "string") {
    monoWebhookReceivedTotal.inc({ status: "invalid_secret" });
    res.status(404).json({ error: "Not found" });
    return;
  }

  const connResult = await query<{
    user_id: string;
    webhook_secret: string;
  }>(
    "SELECT user_id, webhook_secret FROM mono_connection WHERE webhook_secret = $1 AND status = 'active'",
    [secret],
    { op: "mono_webhook_lookup" },
  );

  if (connResult.rows.length === 0) {
    monoWebhookReceivedTotal.inc({ status: "invalid_secret" });
    res.status(404).json({ error: "Not found" });
    return;
  }

  const conn = connResult.rows[0];

  // AI-DANGER: timing-safe comparison is critical here. Do not replace with === or change the secret-lookup flow without coordinating a secret-rotation.
  if (!timingSafeEqual(conn.webhook_secret, secret)) {
    monoWebhookReceivedTotal.inc({ status: "invalid_secret" });
    res.status(404).json({ error: "Not found" });
    return;
  }

  const userId = conn.user_id;

  const payload = req.body as WebhookPayload | undefined;
  if (
    !payload ||
    typeof payload !== "object" ||
    payload.type !== "StatementItem" ||
    !payload.data?.account ||
    !payload.data?.statementItem?.id
  ) {
    monoWebhookReceivedTotal.inc({ status: "bad_payload" });
    res.status(400).json({ error: "Invalid payload" });
    return;
  }

  const { account: monoAccountId, statementItem: item } = payload.data;

  try {
    await query(
      `INSERT INTO mono_transaction
         (user_id, mono_account_id, mono_tx_id, time, amount, operation_amount,
          currency_code, mcc, original_mcc, hold, description, comment,
          cashback_amount, commission_rate, balance, receipt_id, invoice_id,
          counter_edrpou, counter_iban, counter_name, raw, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
               $15, $16, $17, $18, $19, $20, $21, 'webhook')
       ON CONFLICT (user_id, mono_tx_id) DO UPDATE SET
         amount = EXCLUDED.amount,
         operation_amount = EXCLUDED.operation_amount,
         hold = EXCLUDED.hold,
         balance = EXCLUDED.balance,
         description = EXCLUDED.description,
         comment = EXCLUDED.comment,
         raw = EXCLUDED.raw,
         received_at = NOW()`,
      [
        userId,
        monoAccountId,
        item.id,
        new Date(item.time * 1000).toISOString(),
        item.amount,
        item.operationAmount,
        item.currencyCode,
        item.mcc ?? null,
        item.originalMcc ?? null,
        item.hold ?? null,
        item.description ?? null,
        item.comment ?? null,
        item.cashbackAmount ?? null,
        item.commissionRate ?? null,
        item.balance ?? null,
        item.receiptId ?? null,
        item.invoiceId ?? null,
        item.counterEdrpou ?? null,
        item.counterIban ?? null,
        item.counterName ?? null,
        JSON.stringify(item),
      ],
      { op: "mono_tx_upsert" },
    );

    if (item.balance != null) {
      await query(
        `UPDATE mono_account
         SET balance = $1, last_seen_at = NOW()
         WHERE user_id = $2 AND mono_account_id = $3`,
        [item.balance, userId, monoAccountId],
        { op: "mono_account_balance" },
      );
    }

    await query(
      `UPDATE mono_connection
       SET last_event_at = NOW(), updated_at = NOW()
       WHERE user_id = $1`,
      [userId],
      { op: "mono_connection_event" },
    );

    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    monoWebhookReceivedTotal.inc({ status: "ok" });
    monoWebhookDurationMs.observe({ status: "ok" }, ms);

    logger.info({
      msg: "mono_webhook_processed",
      monoAccountId,
      monoTxId: item.id,
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    monoWebhookReceivedTotal.inc({ status: "error" });
    monoWebhookDurationMs.observe({ status: "error" }, ms);
    logger.error({ msg: "mono_webhook_error", err });
    throw err;
  }
}
