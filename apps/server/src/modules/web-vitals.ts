import type { Request, Response } from "express";
import {
  WEB_VITALS_TIMING_METRIC_NAMES,
  WebVitalsPayloadSchema,
  type WebVitalsTimingMetricName,
} from "@sergeant/shared";
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
 *
 * Схема `WebVitalsPayloadSchema` живе в `@sergeant/shared` — клієнт
 * (`apps/web/src/core/webVitals.ts`) валідує той самий payload, тож будь-яка
 * зміна shape рухається одночасно на обох сторонах.
 */

const TIMING_METRICS = new Set<WebVitalsTimingMetricName>(
  WEB_VITALS_TIMING_METRIC_NAMES,
);

export default function webVitalsHandler(req: Request, res: Response): void {
  // sendBeacon з `type: "application/json"` приходить як Buffer/string залежно
  // від middleware-а — Express `express.json()` уже парсить у req.body, але
  // якщо клієнт помилиться з content-type, body може бути undefined.
  const parsed = WebVitalsPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    if (Math.random() < 0.01) {
      logger.warn({
        msg: "web_vitals_invalid_payload",
        issues: parsed.error.issues?.slice(0, 3),
      });
    }
    res.status(204).end();
    return;
  }

  for (const m of parsed.data.metrics) {
    try {
      if (m.name === "CLS") {
        webVitalsCls.observe({ rating: m.rating }, m.value);
      } else if (TIMING_METRICS.has(m.name as WebVitalsTimingMetricName)) {
        webVitalsDurationMs.observe(
          { metric: m.name, rating: m.rating },
          m.value,
        );
      }
    } catch {
      /* metrics must never break the handler */
    }
  }

  res.status(204).end();
}
