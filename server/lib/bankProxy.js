import crypto from "node:crypto";
import { logger } from "../obs/logger.js";
import { recordExternalHttp } from "./externalHttp.js";
import { ExternalServiceError } from "../obs/errors.js";

/**
 * Спільний transport-шар для банківських upstream-проксі (Monobank, PrivatBank).
 * Інкапсулює AbortController-таймаут, експоненційний retry з jitter для 5xx/мережевих
 * помилок, per-upstream circuit breaker та in-memory TTL-кеш для ідентичних GET.
 *
 * Розподіл відповідальності: path-whitelist і sanitizing заголовків залишаються в
 * handler-ах (`modules/mono.js`, `modules/privat.js`) — це policy, не transport.
 *
 * Стан (breakers, cache) — module-level. `__bankProxyTestHooks()` експортується тільки
 * для unit-тестів (скидання стану, конфіг retry-затримок/TTL).
 */

const DEFAULTS = Object.freeze({
  retryDelaysMs: [0, 250, 750],
  retryJitterMs: 100,
  timeoutMs: 15_000,
  breakerFailThreshold: 5,
  breakerOpenMs: 30_000,
  cacheTtlMs: 60_000,
  cacheMaxEntries: 500,
});

const state = {
  retryDelaysMs: [...DEFAULTS.retryDelaysMs],
  retryJitterMs: DEFAULTS.retryJitterMs,
  timeoutMs: DEFAULTS.timeoutMs,
  breakerFailThreshold: DEFAULTS.breakerFailThreshold,
  breakerOpenMs: DEFAULTS.breakerOpenMs,
  cacheTtlMs: DEFAULTS.cacheTtlMs,
  cacheMaxEntries: DEFAULTS.cacheMaxEntries,
  /** @type {Map<string, {failures:number, openUntil:number}>} */
  breakers: new Map(),
  /** @type {Map<string, {expires:number, status:number, body:string, contentType:string|null}>} */
  cache: new Map(),
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetryableStatus(s) {
  return s >= 500 && s <= 599;
}

function isAbortError(e) {
  return Boolean(
    e && (e.name === "AbortError" || e.code === "ABORT_ERR" || e.code === 20),
  );
}

function jitteredDelay(base) {
  if (base <= 0) return 0;
  return base + Math.floor(Math.random() * state.retryJitterMs);
}

function hashForCache(...parts) {
  const h = crypto.createHash("sha256");
  for (const p of parts) h.update(String(p ?? "") + "\x1f");
  return h.digest("hex").slice(0, 16);
}

function getBreaker(upstream) {
  let s = state.breakers.get(upstream);
  if (!s) {
    s = { failures: 0, openUntil: 0 };
    state.breakers.set(upstream, s);
  }
  return s;
}

function onBreakerFailure(upstream) {
  const s = getBreaker(upstream);
  s.failures += 1;
  if (s.failures >= state.breakerFailThreshold) {
    s.openUntil = Date.now() + state.breakerOpenMs;
  }
}

function onBreakerSuccess(upstream) {
  const s = getBreaker(upstream);
  s.failures = 0;
  s.openUntil = 0;
}

function isBreakerOpen(upstream) {
  const s = getBreaker(upstream);
  if (!s.openUntil) return false;
  if (Date.now() < s.openUntil) return true;
  // Вікно минуло — half-open: дозволяємо один пробний запит. Якщо він fail-не,
  // onBreakerFailure знову підніме openUntil; успіх — onBreakerSuccess обнулить.
  s.openUntil = 0;
  return false;
}

function cacheGet(key) {
  const entry = state.cache.get(key);
  if (!entry) return null;
  if (entry.expires < Date.now()) {
    state.cache.delete(key);
    return null;
  }
  // LRU-ish: перекласти в кінець
  state.cache.delete(key);
  state.cache.set(key, entry);
  return entry;
}

function cacheSet(key, entry) {
  if (state.cache.size >= state.cacheMaxEntries) {
    const oldest = state.cache.keys().next().value;
    if (oldest !== undefined) state.cache.delete(oldest);
  }
  state.cache.set(key, entry);
}

/**
 * @typedef {Object} BankProxyResult
 * @property {number} status
 * @property {string} body                — сирий текст відповіді upstream-а
 * @property {string|null} contentType
 * @property {boolean} fromCache
 * @property {number} attempts            — скільки HTTP-спроб було зроблено (1..3)
 */

/**
 * @param {Object} opts
 * @param {string} opts.upstream          — стабільний label (monobank|privatbank|...)
 * @param {string} opts.baseUrl           — напр. "https://api.monobank.ua"
 * @param {string} opts.path              — уже провалідований whitelist-шлях
 * @param {Record<string,string>} [opts.query]    — query-параметри без `path`
 * @param {Record<string,string>} opts.headers    — sanitized outbound headers
 * @param {string} [opts.cacheKeySecret]  — client-secret для shard-у cache-ключа (hash-ується)
 * @param {string} [opts.method]          — default "GET". Не-GET не кешуються.
 * @param {number} [opts.timeoutMs]
 * @returns {Promise<BankProxyResult>}
 */
export async function bankProxyFetch(opts) {
  const {
    upstream,
    baseUrl,
    path,
    query,
    headers,
    cacheKeySecret,
    method = "GET",
    timeoutMs = state.timeoutMs,
  } = opts;

  const qs = query ? new URLSearchParams(query).toString() : "";
  const url = `${baseUrl}${path}${qs ? "?" + qs : ""}`;

  const cacheable = method === "GET";
  const cacheKey = cacheable
    ? `${upstream}|${path}|${qs}|${hashForCache(cacheKeySecret)}`
    : null;

  if (cacheKey) {
    const hit = cacheGet(cacheKey);
    if (hit) {
      recordExternalHttp(upstream, "hit", 0);
      return {
        status: hit.status,
        body: hit.body,
        contentType: hit.contentType,
        fromCache: true,
        attempts: 0,
      };
    }
  }

  if (isBreakerOpen(upstream)) {
    recordExternalHttp(upstream, "circuit_open", 0);
    throw new ExternalServiceError(
      "Сервіс банку тимчасово недоступний — спробуйте пізніше",
      {
        status: 503,
        code: `${upstream.toUpperCase()}_CIRCUIT_OPEN`,
      },
    );
  }

  const maxAttempts = state.retryDelaysMs.length;
  const start = process.hrtime.bigint();

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const delay = jitteredDelay(state.retryDelaysMs[attempt]);
    if (delay > 0) await sleep(delay);

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method,
        headers,
        signal: controller.signal,
      });
      const body = await response.text();

      // Ретраїмо тільки 5xx, і лише якщо є ще спроби.
      if (isRetryableStatus(response.status) && attempt < maxAttempts - 1) {
        continue;
      }

      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      if (response.ok) {
        onBreakerSuccess(upstream);
        recordExternalHttp(upstream, "ok", ms);
      } else if (response.status === 429) {
        recordExternalHttp(upstream, "rate_limited", ms);
        // 429 — це троттлінг, не availability-issue; breaker не торкаємо.
      } else if (response.status >= 500) {
        onBreakerFailure(upstream);
        recordExternalHttp(upstream, "error", ms);
      } else {
        // 4xx auth/validation — не availability-issue; breaker не торкаємо.
        recordExternalHttp(upstream, "error", ms);
      }

      const contentType = response.headers.get("content-type");
      if (cacheKey && response.ok) {
        cacheSet(cacheKey, {
          expires: Date.now() + state.cacheTtlMs,
          status: response.status,
          body,
          contentType,
        });
      }

      return {
        status: response.status,
        body,
        contentType,
        fromCache: false,
        attempts: attempt + 1,
      };
    } catch (e) {
      // Мережева помилка або AbortError (timeout). Ретраїмо до вичерпання.
      if (attempt < maxAttempts - 1) {
        continue;
      }
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      onBreakerFailure(upstream);
      recordExternalHttp(upstream, isAbortError(e) ? "timeout" : "error", ms);
      logger.error({
        msg: `${upstream}_proxy_failed`,
        err: { message: e?.message || String(e), code: e?.code },
        attempts: attempt + 1,
      });
      throw new ExternalServiceError("Помилка сервера", {
        code: `${upstream.toUpperCase()}_FETCH_FAILED`,
        cause: e,
      });
    } finally {
      clearTimeout(t);
    }
  }

  // Недосяжно: цикл завжди або повертає, або кидає.
  /* c8 ignore next */
  throw new ExternalServiceError("Помилка сервера", {
    code: `${upstream.toUpperCase()}_UNEXPECTED`,
  });
}

/**
 * Test-only hooks. Не використовуй у прод-коді.
 */
export function __bankProxyTestHooks() {
  return {
    configure(overrides) {
      for (const [k, v] of Object.entries(overrides)) {
        if (k in state) state[k] = v;
      }
    },
    reset() {
      state.breakers.clear();
      state.cache.clear();
      state.retryDelaysMs = [...DEFAULTS.retryDelaysMs];
      state.retryJitterMs = DEFAULTS.retryJitterMs;
      state.timeoutMs = DEFAULTS.timeoutMs;
      state.breakerFailThreshold = DEFAULTS.breakerFailThreshold;
      state.breakerOpenMs = DEFAULTS.breakerOpenMs;
      state.cacheTtlMs = DEFAULTS.cacheTtlMs;
      state.cacheMaxEntries = DEFAULTS.cacheMaxEntries;
    },
    state,
  };
}
