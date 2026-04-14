const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

export async function anthropicMessages(apiKey, payload, { timeoutMs = 20000 } = {}) {
  const maxAttempts = 3;
  const retryDelayMs = [0, 250, 750];

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

      return { response, data };
    } catch (e) {
      // На явний timeout (AbortError) краще не "допалювати" запити.
      if (isAbortError(e) || attempt >= maxAttempts) throw e;
      continue;
    } finally {
      clearTimeout(t);
    }
  }

  // На випадок якщо цикл завершився без return (теоретично не має статись).
  return { response: lastResponse, data: lastData };
}

export function extractAnthropicText(data) {
  return (data?.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

function shouldRetryStatus(status) {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 529;
}

function isAbortError(e) {
  return !!e && (e.name === "AbortError" || /abort/i.test(String(e?.message || "")));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

