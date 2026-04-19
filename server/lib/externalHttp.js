import {
  externalHttpDurationMs,
  externalHttpRequestsTotal,
} from "../obs/metrics.js";

/**
 * Уніфікований recorder для outbound HTTP-викликів. Замінює чотири
 * майже ідентичні per-upstream helper-и (`recordMono`, `recordPrivat`,
 * `recordLookup`, `recordSend`) — лейбл `upstream` відрізняв їх один від
 * одного і більше нічим.
 *
 * Викликай ОДИН раз на обробку зовнішнього запиту (навіть при retry —
 * рахуємо «логічний» outcome, не кожну HTTP-спробу окремо). Всі throw-и
 * всередині блоку metrics перехоплюються: metrics не мають ламати handler.
 *
 * @param {string} upstream  — стабільне ім'я upstream-а для Prometheus-label
 * @param {string} outcome   — "ok" | "error" | "timeout" | "rate_limited" | ...
 * @param {number|null} [ms] — тривалість у мс (опціонально)
 */
export function recordExternalHttp(upstream, outcome, ms) {
  try {
    externalHttpRequestsTotal.inc({ upstream, outcome });
    if (ms != null) {
      externalHttpDurationMs.observe({ upstream, outcome }, ms);
    }
  } catch {
    /* metrics must never break a request */
  }
}
