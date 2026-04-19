import webpush from "web-push";
import pool from "../db.js";
import { logger } from "../obs/logger.js";
import { recordExternalHttp } from "../lib/externalHttp.js";
import { pushSendsTotal } from "../obs/metrics.js";
import { validateBody } from "../http/validate.js";
import {
  PushSendSchema,
  PushSubscribeSchema,
  PushUnsubscribeSchema,
} from "../http/schemas.js";

/**
 * Дублюємо два лейбли для одного outcome: історичну domain-метрику
 * `push_sends_total` (яку можуть читати старі дашборди/алерти) та уніфіковану
 * `external_http_requests_total{upstream="push"}`. Це свідома тимчасова
 * дуплікація — якщо й зносити, то окремим PR зі знесенням дашборду.
 */
function recordSend(outcome) {
  try {
    pushSendsTotal.inc({ outcome });
  } catch {
    /* ignore */
  }
  recordExternalHttp("push", outcome);
}

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL || "mailto:admin@example.com";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
}

/** GET /api/push/vapid-public — повертає публічний VAPID ключ для підписки. */
export async function vapidPublic(_req, res) {
  if (!VAPID_PUBLIC) {
    return res.status(503).json({ error: "Push not configured" });
  }
  res.json({ publicKey: VAPID_PUBLIC });
}

/** POST /api/push/subscribe — зберегти підписку. Session в `req.user`. */
export async function subscribe(req, res) {
  if (!VAPID_PUBLIC)
    return res.status(503).json({ error: "Push not configured" });

  const user = req.user;
  const parsed = validateBody(PushSubscribeSchema, req, res);
  if (!parsed.ok) return;
  const { endpoint, keys } = parsed.data;

  await pool.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (endpoint) DO UPDATE SET p256dh = $3, auth = $4`,
    [user.id, endpoint, keys.p256dh, keys.auth],
  );
  res.json({ ok: true });
}

/** DELETE /api/push/subscribe — видалити підписку. Session в `req.user`. */
export async function unsubscribe(req, res) {
  const user = req.user;
  const parsed = validateBody(PushUnsubscribeSchema, req, res);
  if (!parsed.ok) return;
  const { endpoint } = parsed.data;

  await pool.query(
    `DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`,
    [user.id, endpoint],
  );
  res.json({ ok: true });
}

/**
 * POST /api/push/send — надіслати push конкретному користувачу (внутрішній API).
 * Body: { userId, title, body, module, tag }
 *
 * Auth через `X-Api-Secret` зроблено в `requireApiSecret("API_SECRET")` на
 * рівні роутера; handler вже отримує запит з перевіреним секретом.
 */
export async function sendPush(req, res) {
  if (!VAPID_PUBLIC)
    return res.status(503).json({ error: "Push not configured" });

  const parsed = validateBody(PushSendSchema, req, res);
  if (!parsed.ok) return;
  const { userId, title, body, module: mod, tag } = parsed.data;

  const { rows } = await pool.query(
    `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1`,
    [userId],
  );
  if (rows.length === 0) return res.json({ sent: 0 });

  const payload = JSON.stringify({
    title,
    body: body || "",
    module: mod || null,
    tag: tag || null,
  });
  let sent = 0;
  const stale = [];

  // Вузький per-subscription catch: одна невдала підписка не повинна
  // зривати весь fan-out. Інші помилки (DB, тощо) летять наверх в errorHandler.
  await Promise.all(
    rows.map(async (row) => {
      const sub = {
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      };
      try {
        await webpush.sendNotification(sub, payload);
        sent++;
        recordSend("ok");
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) {
          stale.push(row.endpoint);
          recordSend("invalid_endpoint");
        } else if (e.statusCode === 429) {
          recordSend("rate_limited");
          logger.warn({
            msg: "push_rate_limited",
            status: e.statusCode,
            err: { message: e?.message },
          });
        } else {
          recordSend("error");
          logger.warn({
            msg: "push_send_error",
            status: e.statusCode,
            err: { message: e?.message },
          });
        }
      }
    }),
  );

  if (stale.length > 0) {
    await pool.query(
      `DELETE FROM push_subscriptions WHERE endpoint = ANY($1)`,
      [stale],
    );
  }

  res.json({ sent, stale: stale.length });
}
