import * as Sentry from "@sentry/react";

let initialized = false;

/**
 * Ініціалізує Sentry в браузері, якщо задано VITE_SENTRY_DSN.
 * Без DSN — no-op (dev/preview без моніторингу).
 */
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn || initialized) return;

  Sentry.init({
    dsn,
    environment:
      import.meta.env.VITE_SENTRY_ENVIRONMENT ||
      import.meta.env.MODE ||
      "production",
    release: import.meta.env.VITE_SENTRY_RELEASE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        // Не маскуємо текст — у застосунку немає PII окрім введених юзером даних;
        // їх можна окремо замаскувати beforeSend-ом при потребі.
        maskAllText: false,
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate:
      Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE) || 0.1,
    replaysSessionSampleRate:
      Number(import.meta.env.VITE_SENTRY_REPLAY_SAMPLE_RATE) || 0,
    replaysOnErrorSampleRate: 1.0,
    beforeSend(event) {
      // Приховуємо cookies/авто-налаштування, щоб не відправляти sid.
      if (event.request?.cookies) delete event.request.cookies;
      return event;
    },
  });

  initialized = true;
}

export { Sentry };
