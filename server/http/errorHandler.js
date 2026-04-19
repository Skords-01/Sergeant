import * as Sentry from "@sentry/node";
import { logger, serializeError } from "../obs/logger.js";
import { als } from "../obs/requestContext.js";
import { appErrorsTotal } from "../obs/metrics.js";
import { isOperationalError } from "../obs/errors.js";

/**
 * Термінальний error handler Express. Має стояти ПІСЛЯ
 * `attachSentryErrorHandler(app)` — той захопить stack і передасть далі.
 *
 * Правила:
 *  - `AppError` і підкласи → 4xx + `warn` + стабільне JSON body з `code`.
 *  - Все інше → 500 + `error` + generic message; деталі лише в логах/Sentry.
 *  - Клієнт завжди отримує `requestId`, щоб було що вставити в тікет.
 */
export function errorHandler(err, req, res, _next) {
  const operational = isOperationalError(err);
  const status = Number(err?.status) || (operational ? 400 : 500);
  const code =
    (typeof err?.code === "string" && err.code) ||
    (status === 429 ? "RATE_LIMIT" : operational ? "BAD_REQUEST" : "INTERNAL");
  const mod = als.getStore()?.module || "unknown";

  try {
    appErrorsTotal.inc({
      kind: operational ? "operational" : "programmer",
      status: String(status),
      code,
      module: mod,
    });
  } catch {
    /* metrics must never break error handling */
  }

  const level = status >= 500 ? "error" : "warn";
  logger[level]({
    msg: "request_failed",
    method: req.method,
    path: req.route?.path || req.originalUrl,
    status,
    code,
    module: mod,
    err: serializeError(err, { includeStack: status >= 500 }),
  });

  // Явний виклик `Sentry.captureException` на справжні помилки (5xx /
  // не-operational). `setupExpressErrorHandler` з `server/sentry.js` теж це
  // ловить, але дубль-safe: якщо порядок middleware колись зміниться і
  // Sentry-хендлер не спрацює, ми все одно отримаємо подію. Sentry сам дедупає
  // однакові events, тому подвійних подій у проді не буде.
  if (status >= 500 && !operational) {
    try {
      Sentry.captureException(err);
    } catch {
      /* Sentry must never break error handling */
    }
  }

  if (res.headersSent) return;

  res.status(status).json({
    error: operational ? err.message : "Server error",
    code,
    requestId: req.requestId,
  });
}
