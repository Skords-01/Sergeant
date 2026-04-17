/**
 * CORS origins. Додаткові домени: змінна ALLOWED_ORIGINS (через кому).
 * Приклад: https://app.example.com,https://preview-xxx.vercel.app
 */
const DEFAULT_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:4173",
  "http://localhost:5000",
  "https://fizruk.vercel.app",
  "https://sergeant.vercel.app",
  "https://sergeant.2dmanager.com.ua",
];

function getReplitOrigins() {
  const domains = process.env.REPLIT_DOMAINS || "";
  return domains
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => `https://${d}`);
}

export function getAllowedOrigins() {
  const extra = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([...DEFAULT_ORIGINS, ...getReplitOrigins(), ...extra])];
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
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Headers", allowHeaders);
  res.setHeader("Access-Control-Allow-Methods", methods);
}
