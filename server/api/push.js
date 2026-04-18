import { timingSafeEqual } from "crypto";
import webpush from "web-push";
import pool from "../db.js";
import { auth } from "../auth.js";
import { fromNodeHeaders } from "better-auth/node";

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL || "mailto:admin@example.com";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
}

async function getSession(req) {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    return session?.user ?? null;
  } catch {
    return null;
  }
}

/** GET /api/push/vapid-public — повертає публічний VAPID ключ для підписки */
export async function vapidPublic(req, res) {
  if (!VAPID_PUBLIC) {
    return res.status(503).json({ error: "Push not configured" });
  }
  res.json({ publicKey: VAPID_PUBLIC });
}

/** POST /api/push/subscribe — зберегти підписку */
export async function subscribe(req, res) {
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
    console.error("[push] subscribe error", e);
    res.status(500).json({ error: "DB error" });
  }
}

/** DELETE /api/push/subscribe — видалити підписку */
export async function unsubscribe(req, res) {
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
    console.error("[push] unsubscribe error", e);
    res.status(500).json({ error: "DB error" });
  }
}

/**
 * POST /api/push/send — надіслати push конкретному користувачу (внутрішній API).
 * Body: { userId, title, body, module }
 * Захищений API_SECRET щоб не дозволяти довільні запити.
 */
export async function sendPush(req, res) {
  const secret = req.headers["x-api-secret"];
  const expected = process.env.API_SECRET;
  const valid =
    secret &&
    expected &&
    secret.length === expected.length &&
    timingSafeEqual(Buffer.from(secret), Buffer.from(expected));
  if (!valid) {
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
        } catch (e) {
          if (e.statusCode === 404 || e.statusCode === 410) {
            stale.push(row.endpoint);
          } else {
            console.warn("[push] send error", e.statusCode, e.message);
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
    console.error("[push] sendPush error", e);
    res.status(500).json({ error: "Internal error" });
  }
}
