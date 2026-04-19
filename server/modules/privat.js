import { setCorsHeaders } from "../http/cors.js";
import { setRequestModule } from "../obs/requestContext.js";
import { logger } from "../obs/logger.js";
import {
  externalHttpDurationMs,
  externalHttpRequestsTotal,
} from "../obs/metrics.js";

function recordPrivat(outcome, ms) {
  try {
    externalHttpRequestsTotal.inc({ upstream: "privatbank", outcome });
    if (ms != null) {
      externalHttpDurationMs.observe({ upstream: "privatbank", outcome }, ms);
    }
  } catch {
    /* ignore */
  }
}

export default async function handler(req, res) {
  setRequestModule("finyk");
  setCorsHeaders(res, req, {
    allowHeaders: "X-Privat-Id, X-Privat-Token, Content-Type",
    methods: "GET, OPTIONS",
  });

  if (req.method === "OPTIONS") return res.status(200).end();

  const merchantId = req.headers["x-privat-id"];
  const merchantToken = req.headers["x-privat-token"];
  const rawPath = req.query.path || "/statements/balance/final";

  if (!merchantId || !merchantToken) {
    return res.status(401).json({ error: "Credentials відсутні" });
  }

  // Валідація шляху API: лише безпечні символи, без CRLF, ?, #, ..
  // і точна відповідність дозволеному префіксу (рівний шлях або префікс+"/…").
  const path = String(rawPath);
  if (!/^\/[A-Za-z0-9\-_/]+$/.test(path) || path.includes("..")) {
    return res.status(400).json({ error: "Недозволений API шлях" });
  }

  const allowedPaths = [
    "/statements/balance/final",
    "/statements/transactions",
  ];

  const pathAllowed = allowedPaths.some(
    (p) => path === p || path.startsWith(p + "/"),
  );
  if (!pathAllowed) {
    return res.status(400).json({ error: "Недозволений API шлях" });
  }

  // Відкидаємо небезпечні символи у значеннях заголовків (CRLF-injection захист).
  const safeHeader = (v) => {
    const s = String(v);
    if (/[\r\n]/.test(s)) return null;
    return s;
  };
  const safeId = safeHeader(merchantId);
  const safeToken = safeHeader(merchantToken);
  if (!safeId || !safeToken) {
    return res.status(400).json({ error: "Недозволений заголовок" });
  }

  const queryParams = new URLSearchParams(req.query);
  queryParams.delete("path");
  const queryString = queryParams.toString();

  const start = process.hrtime.bigint();
  try {
    const url = `https://acp.privatbank.ua/api${path}${queryString ? "?" + queryString : ""}`;
    const response = await fetch(url, {
      headers: {
        id: safeId,
        token: safeToken,
        "Content-Type": "application/json;charset=utf-8",
      },
    });
    const ms = Number(process.hrtime.bigint() - start) / 1e6;

    if (!response.ok) {
      recordPrivat(response.status === 429 ? "rate_limited" : "error", ms);
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

    recordPrivat("ok", ms);
    const data = await response.json();
    res.status(200).json(data);
  } catch (e) {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    recordPrivat("error", ms);
    logger.error({
      msg: "privat_proxy_failed",
      err: { message: e?.message || String(e), code: e?.code },
    });
    res.status(500).json({ error: "Помилка сервера" });
  }
}
