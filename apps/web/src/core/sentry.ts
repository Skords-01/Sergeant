import { getPlatform, isCapacitor } from "@sergeant/shared";

let initialized = false;
let sentryModule = null;

function parseRate(val, fallback) {
  if (val == null || val === "") return fallback;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Лениво завантажує `@sentry/react` і ініціалізує Sentry у браузері.
 *
 * Навмисно через динамічний `import()`, щоб SDK (~30–40 KB gzip) не
 * потрапляв у головний бандл — аналітика/error tracking не повинні
 * блокувати hydration (див. правило 2.3 у
 * `.agents/skills/vercel-react-best-practices/AGENTS.md`).
 *
 * Без `VITE_SENTRY_DSN` — no-op і жодного чанку не підтягується.
 */
export async function initSentry() {
  if (initialized) return;
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  const mod = await import("@sentry/react");
  sentryModule = mod;

  mod.init({
    dsn,
    environment:
      import.meta.env.VITE_SENTRY_ENVIRONMENT ||
      import.meta.env.MODE ||
      "production",
    release: import.meta.env.VITE_SENTRY_RELEASE,
    integrations: [
      mod.browserTracingIntegration(),
      mod.replayIntegration({
        maskAllText: false,
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate: parseRate(
      import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE,
      0.1,
    ),
    replaysSessionSampleRate: parseRate(
      import.meta.env.VITE_SENTRY_REPLAY_SAMPLE_RATE,
      0,
    ),
    replaysOnErrorSampleRate: 1.0,
    beforeSend(event) {
      if (event.request?.cookies) delete event.request.cookies;
      return event;
    },
  });

  // Теги для тріажу: відрізнити події з нативного Capacitor WebView від
  // браузерних (native-specific баги: inset, кукі, keyboard resize тощо).
  mod.setTag("platform", getPlatform());
  mod.setTag("is_capacitor", String(isCapacitor()));

  initialized = true;
}

/**
 * Lazy-forward wrapper: поки SDK не завантажений — no-op, потім
 * делегує у реальний `Sentry.captureException`. Використовується
 * локальним `ErrorBoundary`, щоб не змушувати його залежати від SDK.
 */
export function captureException(error, hint) {
  if (!sentryModule) return;
  try {
    sentryModule.captureException(error, hint);
  } catch {
    /* noop */
  }
}
