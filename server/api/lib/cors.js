/**
 * CORS для Vercel serverless. Додаткові домени: змінна ALLOWED_ORIGINS (через кому).
 * Приклад: https://app.example.com,https://preview-xxx.vercel.app
 */
const DEFAULT_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:4173",
  "https://finto-flame.vercel.app",
  "https://fizruk.vercel.app",
];

export function getAllowedOrigins() {
  const raw = process.env.ALLOWED_ORIGINS;
  if (raw && String(raw).trim()) {
    return String(raw)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return DEFAULT_ORIGINS;
}

/**
 * @param {import('http').ServerResponse} res
 * @param {import('http').IncomingMessage} req
 * @param {{ allowHeaders?: string; methods?: string }} [opts]
 */
export function setCorsHeaders(res, req, opts = {}) {
  const { allowHeaders = "Content-Type", methods = "GET, POST, OPTIONS" } =
    opts;
  const origin = req.headers.origin;
  const allowed = getAllowedOrigins();
  if (origin && allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Headers", allowHeaders);
  res.setHeader("Access-Control-Allow-Methods", methods);
}
