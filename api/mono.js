import { setCorsHeaders } from "./lib/cors.js";

export default async function handler(req, res) {
  setCorsHeaders(res, req, {
    allowHeaders: "X-Token, Content-Type",
    methods: "GET, POST, OPTIONS",
  });

  if (req.method === "OPTIONS") return res.status(200).end();

  const token = req.headers["x-token"];
  const path = req.query.path || "/personal/client-info";

  if (!token) {
    return res.status(401).json({ error: "Токен відсутній" });
  }

  // Валідація шляху API
  const allowedPaths = ["/personal/client-info", "/personal/statement/"];

  if (!allowedPaths.some((allowed) => path.startsWith(allowed))) {
    return res.status(400).json({ error: "Недозволений API шлях" });
  }

  try {
    const response = await fetch(`https://api.monobank.ua${path}`, {
      headers: { "X-Token": token },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        error: response.status === 429 ? "Занадто багато запитів" : errorText,
      });
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (e) {
    console.error("API Error:", e);
    res.status(500).json({ error: "Помилка сервера" });
  }
}
