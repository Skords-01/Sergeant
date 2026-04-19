import {
  aiRequestDurationMs,
  aiRequestsTotal,
  aiTokensTotal,
  externalHttpDurationMs,
  externalHttpRequestsTotal,
} from "../obs/metrics.js";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

function recordOutcome(outcome, { model, endpoint, ms }) {
  try {
    externalHttpRequestsTotal.inc({ upstream: "anthropic", outcome });
    if (ms != null) {
      externalHttpDurationMs.observe({ upstream: "anthropic", outcome }, ms);
    }
    aiRequestsTotal.inc({
      provider: "anthropic",
      model: model || "unknown",
      endpoint: endpoint || "unknown",
      outcome,
    });
    if (ms != null) {
      aiRequestDurationMs.observe(
        {
          provider: "anthropic",
          model: model || "unknown",
          endpoint: endpoint || "unknown",
        },
        ms,
      );
    }
  } catch {
    /* metrics must never break a request */
  }
}

function recordUsage(model, data) {
  try {
    const usage = data?.usage;
    if (!usage) return;
    if (Number.isFinite(usage.input_tokens)) {
      aiTokensTotal.inc(
        { provider: "anthropic", model, kind: "prompt" },
        usage.input_tokens,
      );
    }
    if (Number.isFinite(usage.output_tokens)) {
      aiTokensTotal.inc(
        { provider: "anthropic", model, kind: "completion" },
        usage.output_tokens,
      );
    }
  } catch {
    /* ignore */
  }
}

export async function anthropicMessages(
  apiKey,
  payload,
  { timeoutMs = 20000, endpoint = "unknown" } = {},
) {
  const maxAttempts = 3;
  const retryDelayMs = [0, 250, 750];
  const model = payload?.model || "unknown";
  const overallStart = process.hrtime.bigint();

  /** @type {Response|null} */
  let lastResponse = null;
  /** @type {any} */
  let lastData = {};

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      if (retryDelayMs[attempt - 1]) {
        await sleep(retryDelayMs[attempt - 1]);
      }

      const response = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const data = await response.json().catch(() => ({}));
      lastResponse = response;
      lastData = data;

      // Ретраїмо тільки тимчасові/перевантажені стани.
      if (shouldRetryStatus(response.status) && attempt < maxAttempts) continue;

      const ms = Number(process.hrtime.bigint() - overallStart) / 1e6;
      if (response.ok) {
        recordOutcome("ok", { model, endpoint, ms });
        recordUsage(model, data);
      } else {
        recordOutcome(response.status === 429 ? "rate_limited" : "error", {
          model,
          endpoint,
          ms,
        });
      }
      return { response, data };
    } catch (e) {
      // На явний timeout (AbortError) краще не "допалювати" запити.
      if (isAbortError(e) || attempt >= maxAttempts) {
        const ms = Number(process.hrtime.bigint() - overallStart) / 1e6;
        recordOutcome(isAbortError(e) ? "timeout" : "error", {
          model,
          endpoint,
          ms,
        });
        throw e;
      }
      continue;
    } finally {
      clearTimeout(t);
    }
  }

  // На випадок якщо цикл завершився без return (теоретично не має статись).
  return { response: lastResponse, data: lastData };
}

/**
 * Стрімова версія Anthropic Messages API. Викликає fetch з `stream: true`,
 * інструментує outcome/latency (розмір відповіді = час до закриття з'єднання),
 * і повертає `{ response, recordStreamEnd }`. Викликай `recordStreamEnd(outcome?)`
 * коли боді повністю спожите (або з помилкою) щоб закрити latency-вимір.
 *
 * Таймаут (`AbortController`) навмисно НЕ гаситься у `finally`: боді SSE
 * споживається у caller-і після повернення з цієї функції, тому abort-таймер
 * мусить жити до виклику `recordStreamEnd`, щоб захистити stream від зависання.
 */
export async function anthropicMessagesStream(
  apiKey,
  payload,
  { endpoint = "unknown", timeoutMs = 60000 } = {},
) {
  const model = payload?.model || "unknown";
  const start = process.hrtime.bigint();
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ ...payload, stream: true }),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(t);
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    recordOutcome(isAbortError(e) ? "timeout" : "error", {
      model,
      endpoint,
      ms,
    });
    throw e;
  }

  if (!response.ok) {
    clearTimeout(t);
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    recordOutcome(response.status === 429 ? "rate_limited" : "error", {
      model,
      endpoint,
      ms,
    });
    return { response, recordStreamEnd: () => {} };
  }

  let settled = false;
  const recordStreamEnd = (outcome = "ok") => {
    if (settled) return;
    settled = true;
    clearTimeout(t);
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    recordOutcome(outcome, { model, endpoint, ms });
  };

  return { response, recordStreamEnd };
}

export function extractAnthropicText(data) {
  return (data?.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

function shouldRetryStatus(status) {
  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 529
  );
}

function isAbortError(e) {
  return (
    !!e && (e.name === "AbortError" || /abort/i.test(String(e?.message || "")))
  );
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
