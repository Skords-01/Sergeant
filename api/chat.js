const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

export default async function handler(req, res) {
  const origin = req.headers.origin;
  const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:4173",
    "https://finto-flame.vercel.app",
    "https://fizruk.vercel.app",
  ];

  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY is not set" });

  try {
    const { context = "", messages = [] } = req.body || {};
    const cleanMessages = Array.isArray(messages)
      ? messages
          .filter(m => m?.role === "user" && typeof m?.content === "string" && m.content.trim())
          .slice(-12)
      : [];
    const system = `Ти персональний асистент. Бачиш дані фінансів (бюджети, борги, підписки) і тренувань користувача. Відповідай українською, стисло (2-4 речення). Якщо питання не стосується наявних даних — відповідай загально.

Усі числа, суми, залишки, борги, доходи та витрати бери ТІЛЬКИ з блоку "Дані" нижче. Не використовуй числа з попередніх відповідей асистента, не перераховуй їх самостійно і не вигадуй нових. Якщо в "Дані" чогось немає або воно суперечливе — прямо скажи про це.

Дані: ${context}`;

    const response = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 800,
        system,
        messages: cleanMessages,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      const message = data?.error?.message || data?.error || "AI request failed";
      return res.status(response.status).json({ error: message });
    }

    return res.status(200).json({ text: data?.content?.[0]?.text || "Немає відповіді від AI." });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Помилка AI сервера" });
  }
}
