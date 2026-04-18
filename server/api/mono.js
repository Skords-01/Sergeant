import { setCorsHeaders } from "./lib/cors.js";
import { setRequestModule } from "../obs/requestContext.js";
import { logger } from "../obs/logger.js";
import { externalHttpRequestsTotal } from "../obs/metrics.js";

function recordMono(outcome) {
  try {
    externalHttpRequestsTotal.inc({ upstream: "monobank", outcome });
  } catch {
    /* ignore */
  }
}

export default async function handler(req, res) {
  setRequestModule("finyk");
  setCorsHeaders(res, req, {
    allowHeaders: "X-Token, Content-Type",
    methods: "GET, POST, OPTIONS",
  });

  if (req.method === "OPTIONS") return res.status(200).end();

  const token = req.headers["x-token"];
  const rawPath = req.query.path || "/personal/client-info";

  if (!token) {
    return res.status(401).json({ error: "Токен відсутній" });
  }

  // Валідація шляху API: лише безпечні символи, без CRLF, ?, #, ..
  // і точна відповідність дозволеному префіксу (рівний шлях або префікс+"/…").
  const path = String(rawPath);
  if (!/^\/[A-Za-z0-9\-_/]+$/.test(path) || path.includes("..")) {
    return res.status(400).json({ error: "Недозволений API шлях" });
  }

  const allowedPaths = ["/personal/client-info", "/personal/statement"];
  const pathAllowed = allowedPaths.some(
    (allowed) => path === allowed || path.startsWith(allowed + "/"),
  );
  if (!pathAllowed) {
    return res.status(400).json({ error: "Недозволений API шлях" });
  }

  try {
    const response = await fetch(`https://api.monobank.ua${path}`, {
      headers: { "X-Token": String(token) },
    });

    if (!response.ok) {
      recordMono(response.status === 429 ? "rate_limited" : "error");
      const errorText = await response.text();
      return res.status(response.status).json({
        error: response.status === 429 ? "Занадто багато запитів" : errorText,
      });
    }

    const data = await response.json();
    recordMono("ok");
    res.status(200).json(data);
  } catch (e) {
    recordMono("error");
    logger.error({
      msg: "mono_proxy_failed",
      err: { message: e?.message || String(e), code: e?.code },
    });
    res.status(500).json({ error: "Помилка сервера" });
  }
}
