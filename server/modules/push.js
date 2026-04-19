import webpush from "web-push";
import pool from "../db.js";
import { getSessionUser } from "../auth.js";
import { setRequestModule } from "../obs/requestContext.js";
import { logger } from "../obs/logger.js";
import { pushSendsTotal } from "../obs/metrics.js";

function recordSend(outcome) {
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

/**
 * Лукап сесії з проковтуванням помилок: push-ендпоінти історично трактують
 * будь-яку невдачу better-auth як "не залогінений" і повертають 401, а не 500.
 * Для інших API використовуй `getSessionUser` напряму — там помилки мають
 * підніматись до `errorHandler`.
 */
async function getSession(req) {
  try {
    return await getSessionUser(req);
  } catch {
    return null;
  }
}

/** GET /api/push/vapid-public — повертає публічний VAPID ключ для підписки */
export async function vapidPublic(req, res) {
  setRequestModule("push");
  if (!VAPID_PUBLIC) {
    return res.status(503).json({ error: "Push not configured" });
  }
  res.json({ publicKey: VAPID_PUBLIC });
}

/** POST /api/push/subscribe — зберегти підписку */
export async function subscribe(req, res) {
  setRequestModule("push");
  if (!VAPID_PUBLIC)
    return res.status(503).json({ error: "Push not configured" });
  const user = await getSession(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { endpoint, keys } = req.body || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: "Invalid subscription" });
  }

  try {
    await pool.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (endpoint) DO UPDATE SET p256dh = $3, auth = $4`,
      [user.id, endpoint, keys.p256dh, keys.auth],
    );
    res.json({ ok: true });
  } catch (e) {
    logger.error({
      msg: "push_subscribe_failed",
      err: { message: e?.message || String(e), code: e?.code },
    });
    res.status(500).json({ error: "DB error" });
  }
}

/** DELETE /api/push/subscribe — видалити підписку */
export async function unsubscribe(req, res) {
  setRequestModule("push");
  const user = await getSession(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { endpoint } = req.body || {};
  if (!endpoint) return res.status(400).json({ error: "Missing endpoint" });

  try {
    await pool.query(
      `DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`,
      [user.id, endpoint],
    );
    res.json({ ok: true });
  } catch (e) {
    logger.error({
      msg: "push_unsubscribe_failed",
      err: { message: e?.message || String(e), code: e?.code },
    });
    res.status(500).json({ error: "DB error" });
  }
}

/**
 * POST /api/push/send — надіслати push конкретному користувачу (внутрішній API).
 * Body: { userId, title, body, module }
 * Захищений API_SECRET щоб не дозволяти довільні запити.
 */
export async function sendPush(req, res) {
  setRequestModule("push");
  const secret = req.headers["x-api-secret"];
  if (!secret || secret !== process.env.API_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!VAPID_PUBLIC)
    return res.status(503).json({ error: "Push not configured" });

  const { userId, title, body, module: mod, tag } = req.body || {};
  if (!userId || !title)
    return res.status(400).json({ error: "Missing fields" });

  try {
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
  } catch (e) {
    logger.error({
      msg: "push_send_failed",
      err: { message: e?.message || String(e), code: e?.code },
    });
    res.status(500).json({ error: "Internal error" });
  }
}
