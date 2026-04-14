const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

export async function anthropicMessages(apiKey, payload, { timeoutMs = 20000 } = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
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
    return { response, data };
  } finally {
    clearTimeout(t);
  }
}

export function extractAnthropicText(data) {
  return (data?.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

