import * as Sentry from "@sentry/node";

let initialized = false;

/**
 * Ініціалізує Sentry, якщо задано SENTRY_DSN.
 * У dev/CI без DSN — no-op, щоб не шпигуна власні дії.
 *
 * Must be called якнайраніше — до створення Express-додатка та підключення
 * роутерів, щоб `Sentry.setupExpressErrorHandler` міг захопити помилки.
 */
export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn || initialized) return;

  Sentry.init({
    dsn,
    environment:
      process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
    release: process.env.SENTRY_RELEASE || process.env.RAILWAY_GIT_COMMIT_SHA,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0.1,
    // Приберемо request body зі звітів — там можуть бути фото/паролі.
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request?.data) delete event.request.data;
      if (event.request?.cookies) delete event.request.cookies;
      return event;
    },
  });

  initialized = true;
  console.log(
    JSON.stringify({
      level: "info",
      msg: "sentry_initialized",
      environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    }),
  );
}

/**
 * Підключає Sentry-обробник помилок до Express-додатка.
 * Має викликатись *після* всіх роутерів і *перед* власним error handler-ом.
 */
export function attachSentryErrorHandler(app) {
  if (!initialized) return;
  Sentry.setupExpressErrorHandler(app);
}

export { Sentry };
