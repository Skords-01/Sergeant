import { setCorsHeaders } from "./lib/cors.js";

export default async function handler(req, res) {
  setCorsHeaders(res, req, {
    allowHeaders: "X-Privat-Id, X-Privat-Token, Content-Type",
    methods: "GET, OPTIONS",
  });

  if (req.method === "OPTIONS") return res.status(200).end();

  const merchantId = req.headers["x-privat-id"];
  const merchantToken = req.headers["x-privat-token"];
  const path = req.query.path || "/statements/balance/final";

  if (!merchantId || !merchantToken) {
    return res.status(401).json({ error: "Credentials відсутні" });
  }

  const allowedPaths = [
    "/statements/balance/final",
    "/statements/transactions",
  ];

  if (!allowedPaths.some((p) => path.startsWith(p))) {
    return res.status(400).json({ error: "Недозволений API шлях" });
  }

  const queryParams = new URLSearchParams(req.query);
  queryParams.delete("path");
  const queryString = queryParams.toString();

  try {
    const url = `https://acp.privatbank.ua/api${path}${queryString ? "?" + queryString : ""}`;
    const response = await fetch(url, {
      headers: {
        id: merchantId,
        token: merchantToken,
        "Content-Type": "application/json;charset=utf-8",
      },
    });

    if (!response.ok) {
      let errorText = "";
      try {
        errorText = await response.text();
      } catch {}
      return res.status(response.status).json({
        error:
          response.status === 429
            ? "Занадто багато запитів"
            : response.status === 401 || response.status === 403
              ? "Невірні credentials PrivatBank"
              : errorText || `Помилка ${response.status}`,
      });
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (e) {
    console.error("PrivatBank API Error:", e);
    res.status(500).json({ error: "Помилка сервера" });
  }
}
