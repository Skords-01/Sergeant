import { z } from "zod";
import { logger } from "../obs/logger.js";
import { webVitalsCls, webVitalsDurationMs } from "../obs/metrics.js";

/**
 * POST /api/metrics/web-vitals
 *
 * Приймає батч Core Web Vitals від браузера — клієнт шле через
 * `navigator.sendBeacon` на `pagehide/visibilitychange=hidden`.
 *
 * Endpoint навмисно анонімний (web-vitals важливо міряти в тому числі на
 * неавторизованих відвідувачах) і rate-limited на рівні роутера — див.
 * `rateLimitExpress({ key: "api:web-vitals", ... })` у server/app.js.
 *
 * Завжди відповідає `204 No Content` — навіть на поганий payload. sendBeacon
 * ігнорує відповідь, а тіло з помилками не сенс повертати: клієнта немає кому
 * читати, плюс не хочемо давати зонду детальний feedback на malformed пейлоад.
 *
 * Валідно відхилені записи логуються один раз із `sample=1%` щоб не засмічувати
 * Pino потоком з публічного endpoint.
 */

const TIMING_METRICS = new Set(["LCP", "INP", "FCP", "TTFB"]);

// CLS — безрозмірний, в реальних умовах 0..1+ (0.25 вже "poor"). Таймінги
// (LCP/INP/FCP/TTFB) — мс, з приватним upper-bound 120_000 (2 хв — будь-що
// більше означає зламаний client-side таймер). Окремий upper-bound для CLS
// важливий: без нього анонімний endpoint приймає value=100000 і інфлейтить
// `web_vitals_cls_sum` на порядки, роблячи `avg = _sum / _count` безглуздим.
const MetricSchema = z
  .object({
    name: z.enum(["LCP", "INP", "FCP", "TTFB", "CLS"]),
    value: z.number().finite().min(0),
    rating: z.enum(["good", "needs-improvement", "poor"]),
  })
  .refine((m) => (m.name === "CLS" ? m.value <= 10 : m.value <= 120_000), {
    message: "value out of range for metric",
    path: ["value"],
  });

const PayloadSchema = z.object({
  metrics: z.array(MetricSchema).min(1).max(10),
});

export default function webVitalsHandler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // sendBeacon з `type: "application/json"` приходить як Buffer/string залежно
  // від middleware-а — Express `express.json()` уже парсить у req.body, але
  // якщо клієнт помилиться з content-type, body може бути undefined.
  const parsed = PayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    if (Math.random() < 0.01) {
      logger.warn({
        msg: "web_vitals_invalid_payload",
        issues: parsed.error.issues?.slice(0, 3),
      });
    }
    return res.status(204).end();
  }

  for (const m of parsed.data.metrics) {
    try {
      if (m.name === "CLS") {
        webVitalsCls.observe({ rating: m.rating }, m.value);
      } else if (TIMING_METRICS.has(m.name)) {
        webVitalsDurationMs.observe(
          { metric: m.name, rating: m.rating },
          m.value,
        );
      }
    } catch {
      /* metrics must never break the handler */
    }
  }

  return res.status(204).end();
}
