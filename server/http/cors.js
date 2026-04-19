/**
 * CORS origins. Додаткові домени: змінна ALLOWED_ORIGINS (через кому).
 * Приклад: https://app.example.com,https://preview-xxx.vercel.app
 *
 * Для Vercel preview-деплойменотів із плаваючими hash-префіксами
 * (`sergeant-git-branch-user.vercel.app`) перераховувати кожен URL в
 * ALLOWED_ORIGINS незручно — для цього додана змінна `ALLOWED_ORIGIN_REGEX`
 * (один regex, що тестується проти `req.headers.origin`). Приклад значення:
 *   `^https://(?:sergeant|fizruk)(?:-[a-z0-9-]+)?\.vercel\.app$`
 *
 * Жодних wild-card defaults — щоб випадково не відкрити CORS на чуже
 * Vercel-тенант. Regex треба явно виставити.
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

// Кешуємо скомпільований regex, щоб не пересправляти його на кожен запит.
// Якщо regex невалідний — логуємо один раз і ігноруємо (fail-closed).
let cachedRegexSrc = null;
let cachedRegex = null;
function getAllowedOriginRegex() {
  const src = process.env.ALLOWED_ORIGIN_REGEX || "";
  if (src === cachedRegexSrc) return cachedRegex;
  cachedRegexSrc = src;
  if (!src) {
    cachedRegex = null;
    return null;
  }
  try {
    cachedRegex = new RegExp(src);
  } catch {
    cachedRegex = null;
  }
  return cachedRegex;
}

export function isOriginAllowed(origin) {
  if (!origin) return false;
  if (getAllowedOrigins().includes(origin)) return true;
  const re = getAllowedOriginRegex();
  return re ? re.test(origin) : false;
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
  if (origin && isOriginAllowed(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Headers", allowHeaders);
  res.setHeader("Access-Control-Allow-Methods", methods);
}
