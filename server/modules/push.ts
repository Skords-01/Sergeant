import type { Request, Response } from "express";
import webpush from "web-push";
import pool from "../db.js";
import { sendWebPush } from "../lib/webpushSend.js";
import { pushSendsTotal } from "../obs/metrics.js";
import { validateBody } from "../http/validate.js";
import {
  PushSendSchema,
  PushSubscribeSchema,
  PushUnsubscribeSchema,
} from "../http/schemas.js";

type WithSessionUser = Request & { user?: { id: string } };

/**
 * Historical domain-metric `push_sends_total` — зберігаємо для сумісності
 * з існуючими дашбордами/алертами. Уніфікована `external_http_requests_total
 * {upstream="push"}` вже інкрементиться всередині `sendWebPush` через
 * `recordExternalHttp`, тож тут лише дублюємо domain-лейбл.
 */
function recordDomainOutcome(outcome: string): void {
  try {
    pushSendsTotal.inc({ outcome });
  } catch {
    /* ignore */
  }
}

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL || "mailto:admin@example.com";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
}

/** GET /api/push/vapid-public — повертає публічний VAPID ключ для підписки. */
export async function vapidPublic(_req: Request, res: Response): Promise<void> {
  if (!VAPID_PUBLIC) {
    res.status(503).json({ error: "Push not configured" });
    return;
  }
  res.json({ publicKey: VAPID_PUBLIC });
}

/** POST /api/push/subscribe — зберегти підписку. Session в `req.user`. */
export async function subscribe(req: Request, res: Response): Promise<void> {
  if (!VAPID_PUBLIC) {
    res.status(503).json({ error: "Push not configured" });
    return;
  }

  const user = (req as WithSessionUser).user!;
  const parsed = validateBody(PushSubscribeSchema, req, res);
  if (!parsed.ok) return;
  const { endpoint, keys } = parsed.data;

  // Re-subscribe одного й того ж endpoint-а має «воскресити» soft-deleted
  // рядок (deleted_at = NULL), інакше браузер, який повернувся з 410 → 200
  // через N годин, лишався б вимкненим у нас.
  //
  // EXPLAIN ANALYZE (типовий plan):
  //   Insert on push_subscriptions  (cost=0..12 rows=1)
  //     Conflict Resolution: UPDATE
  //     Conflict Arbiter Indexes: push_subscriptions_endpoint_key
  //       -> Index Scan using push_subscriptions_endpoint_key  (rows=1)
  await pool.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (endpoint) DO UPDATE
         SET p256dh = $3, auth = $4, user_id = $1, deleted_at = NULL`,
    [user.id, endpoint, keys.p256dh, keys.auth],
  );
  res.json({ ok: true });
}

/** DELETE /api/push/subscribe — soft-delete підписки. Session в `req.user`. */
export async function unsubscribe(req: Request, res: Response): Promise<void> {
  const user = (req as WithSessionUser).user!;
  const parsed = validateBody(PushUnsubscribeSchema, req, res);
  if (!parsed.ok) return;
  const { endpoint } = parsed.data;

  // Soft-delete: виставляємо deleted_at замість DELETE. Причини:
  //   1. Збережемо audit history (коли, скільки раз юзер відписувався).
  //   2. Браузери тимчасово повертають 410/404 (TTL expiry, pull-to-refresh
  //      на iOS), потім знову працюють. Hard-DELETE втратив би keys і змусив
  //      SW заново subscribe. З soft-delete наступний subscribe просто
  //      очищує deleted_at (див. вище).
  // WHERE deleted_at IS NULL робить операцію ідемпотентною: повторний
  // unsubscribe не чіпає рядок і не crash-ить constraint-и.
  await pool.query(
    `UPDATE push_subscriptions
        SET deleted_at = NOW()
      WHERE user_id = $1 AND endpoint = $2 AND deleted_at IS NULL`,
    [user.id, endpoint],
  );
  res.json({ ok: true });
}

interface PushSubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * POST /api/push/send — надіслати push конкретному користувачу (внутрішній API).
 * Body: { userId, title, body, module, tag }
 *
 * Auth через `X-Api-Secret` зроблено в `requireApiSecret("API_SECRET")` на
 * рівні роутера; handler вже отримує запит з перевіреним секретом.
 */
export async function sendPush(req: Request, res: Response): Promise<void> {
  if (!VAPID_PUBLIC) {
    res.status(503).json({ error: "Push not configured" });
    return;
  }

  const parsed = validateBody(PushSendSchema, req, res);
  if (!parsed.ok) return;
  const { userId, title, body, module: mod, tag } = parsed.data;

  // EXPLAIN ANALYZE (типовий plan після міграції 005):
  //   Index Scan using idx_push_subs_user_active on push_subscriptions
  //     Index Cond: (user_id = $1)
  //     (фільтр deleted_at IS NULL уже вбудований у partial-index,
  //      тому Rows Removed by Filter = 0)
  const { rows } = await pool.query<PushSubscriptionRow>(
    `SELECT endpoint, p256dh, auth
       FROM push_subscriptions
      WHERE user_id = $1 AND deleted_at IS NULL`,
    [userId],
  );
  if (rows.length === 0) {
    res.json({ sent: 0 });
    return;
  }

  const payload = JSON.stringify({
    title,
    body: body || "",
    module: mod || null,
    tag: tag || null,
  });
  let sent = 0;
  const stale: string[] = [];

  // Per-subscription fan-out: sendWebPush всередині вже має timeout/retry/
  // circuit-breaker і повертає структурований `outcome`. Одна невдала
  // підписка не зриває весь fan-out — Promise.all резолвиться завжди, бо
  // sendWebPush не кидає для очікуваних помилок (4xx/5xx/timeout/breaker).
  await Promise.all(
    rows.map(async (row) => {
      const sub = {
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      };
      const result = await sendWebPush(sub, payload);
      recordDomainOutcome(result.outcome);
      if (result.outcome === "ok") {
        sent++;
      } else if (result.outcome === "invalid_endpoint") {
        stale.push(row.endpoint);
      }
      // timeout/rate_limited/circuit_open/error — вже залоговані у sendWebPush.
    }),
  );

  if (stale.length > 0) {
    // Stale (404/410) від push-сервісу — soft-delete замість DELETE, щоб:
    //   - лишити endpoint у таблиці для analytics (кількість відпадінь);
    //   - якщо браузер знову з'явиться з тим самим endpoint у subscribe,
    //     просто очистимо deleted_at (див. `subscribe` вище) без втрати keys.
    await pool.query(
      `UPDATE push_subscriptions
          SET deleted_at = NOW()
        WHERE endpoint = ANY($1) AND deleted_at IS NULL`,
      [stale],
    );
  }

  res.json({ sent, stale: stale.length });
}
