import type { IncomingMessage, ServerResponse } from "http";

/**
 * CORS origins.
 *
 * Production/staging origins are configured via env vars — do NOT hardcode them:
 *   CORS_ORIGINS=https://sergeant.2dmanager.com.ua,https://sergeant.vercel.app
 *   ALLOWED_ORIGINS=https://preview-xxx.vercel.app   (legacy alias, still supported)
 *
 * localhost origins are always included for local development.
 */
const DEV_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:4173",
  "http://localhost:5000",
];

function getReplitOrigins(): string[] {
  const domains = process.env.REPLIT_DOMAINS ?? "";
  return domains
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => `https://${d}`);
}

function parseEnvOrigins(varName: string): string[] {
  return (process.env[varName] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function getAllowedOrigins(): string[] {
  return [
    ...new Set([
      ...DEV_ORIGINS,
      ...getReplitOrigins(),
      ...parseEnvOrigins("CORS_ORIGINS"),
      ...parseEnvOrigins("ALLOWED_ORIGINS"),
    ]),
  ];
}

interface CorsOptions {
  allowHeaders?: string;
  methods?: string;
}

export function setCorsHeaders(
  res: ServerResponse,
  req: IncomingMessage,
  opts: CorsOptions = {},
): void {
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
