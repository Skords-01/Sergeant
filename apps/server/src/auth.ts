import { betterAuth } from "better-auth";
import { fromNodeHeaders } from "better-auth/node";
import { bearer } from "better-auth/plugins";
import { expo } from "@better-auth/expo";
import type { Request } from "express";
import pool from "./db.js";
import {
  authAttemptsTotal,
  authSessionLookupDurationMs,
} from "./obs/metrics.js";

interface AdvancedCookieOptions {
  useSecureCookies: true;
  defaultCookieAttributes: {
    sameSite: "none";
    secure: true;
  };
}

function getBaseURL(): string {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  if (process.env.REPLIT_DEV_DOMAIN)
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  if (process.env.REPLIT_DOMAINS) {
    const first = process.env.REPLIT_DOMAINS.split(",")[0]?.trim();
    if (first) return `https://${first}`;
  }
  return `http://localhost:${process.env.PORT || 5000}`;
}

/**
 * Фронт (Vercel) і API (Railway) — різні сайти: кукі сесії потребують SameSite=None + Secure.
 * Увімкнено, коли base URL API — HTTPS (типово Railway), якщо не BETTER_AUTH_CROSS_SITE_COOKIES=0.
 * Локально http://localhost — без змін (Lax за замовчуванням у better-auth).
 */
function getAdvancedCookieOptions(): AdvancedCookieOptions | null {
  if (process.env.BETTER_AUTH_CROSS_SITE_COOKIES === "0") {
    return null;
  }
  const base = getBaseURL();
  if (!base.startsWith("https://")) {
    return null;
  }
  return {
    useSecureCookies: true,
    defaultCookieAttributes: {
      sameSite: "none",
      secure: true,
    },
  };
}

const advancedCookies = getAdvancedCookieOptions();

export const auth = betterAuth({
  database: pool,
  baseURL: getBaseURL(),
  basePath: "/api/auth",
  emailAndPassword: {
    enabled: true,
    // NIST SP 800-63B рекомендує мінімум 8 символів; 10 — розумний trade-off,
    // що блокує атаки брут-форсом через словники без UX-пенальті для юзера.
    // maxPasswordLength захищає від DoS через надто довгі bcrypt-пейлоади.
    minPasswordLength: Number(process.env.MIN_PASSWORD_LENGTH) || 10,
    maxPasswordLength: Number(process.env.MAX_PASSWORD_LENGTH) || 128,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },
  trustedOrigins: getTrustedOrigins(),
  /**
   * Плагіни:
   *   - `bearer()` — дозволяє мобільним клієнтам передавати сесію через
   *     `Authorization: Bearer <token>` без cookie. Веб-браузери й далі
   *     можуть ходити з cookie — плагін тільки додає альтернативний
   *     канал, нічого не ламає.
   *   - `expo()` — коригує origin-handling для `sergeant://` / `exp://`
   *     схем і автоматично розширює `trustedOrigins` deep-link-схемами
   *     Expo API Routes.
   */
  plugins: [bearer(), expo()],
  ...(advancedCookies ? { advanced: advancedCookies } : {}),
});

function getTrustedOrigins(): string[] {
  // Mobile-клієнти використовують кастомні схеми deep-link (`sergeant://`,
  // `exp://` у Expo dev) і локальний Metro bundler на `http://localhost:8081`.
  // Better Auth перевіряє `Origin` / `Referer` проти цього списку при
  // чутливих операціях (callback OAuth, cross-origin sign-in) — без явного
  // додавання ці ж запити летіли б у 403.
  const origins: string[] = [
    "http://localhost:5000",
    "http://localhost:5173",
    "http://localhost:8081",
    "sergeant://",
    "exp://",
  ];
  if (process.env.REPLIT_DEV_DOMAIN) {
    origins.push(`https://${process.env.REPLIT_DEV_DOMAIN}`);
  }
  if (process.env.REPLIT_DOMAINS) {
    for (const d of process.env.REPLIT_DOMAINS.split(",")) {
      const trimmed = d.trim();
      if (trimmed) origins.push(`https://${trimmed}`);
    }
  }
  if (process.env.ALLOWED_ORIGINS) {
    for (const o of process.env.ALLOWED_ORIGINS.split(",")) {
      const trimmed = o.trim();
      if (trimmed) origins.push(trimmed);
    }
  }
  return origins;
}

interface SessionUser {
  id: string;
  [key: string]: unknown;
}

export async function getSessionUser(
  req: Request,
): Promise<SessionUser | null> {
  const start = process.hrtime.bigint();
  let outcome: "miss" | "hit" | "error" = "miss";
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    const user = (session?.user ?? null) as SessionUser | null;
    if (user?.id) {
      outcome = "hit";
      // Ліниво прив'язуємо сесію до request-context і Sentry-scope. Завдяки
      // цьому будь-який log/Sentry-івент далі в ланцюжку знає, хто саме
      // виконує запит. Безпечно без сесії — просто no-op.
      try {
        const [{ setUserId }, Sentry] = await Promise.all([
          import("./obs/requestContext.js"),
          import("@sentry/node"),
        ]);
        setUserId(user.id);
        Sentry.getCurrentScope?.().setUser({ id: user.id });
      } catch {
        /* ignore — observability не має блокувати auth */
      }
    }
    return user;
  } catch (e) {
    outcome = "error";
    throw e;
  } finally {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    try {
      authSessionLookupDurationMs.observe({ outcome }, ms);
      authAttemptsTotal.inc({ op: "session_check", outcome });
    } catch {
      /* metrics must never break a request */
    }
  }
}
