import { fileURLToPath } from "url";
import { dirname, join } from "path";

/**
 * Determines which runtime mode the server is starting in.
 *
 * Modes:
 *  - `railway` — API-only deploy (HTTPS, separate frontend on Vercel). Strict API CSP.
 *  - `replit`  — Unified process serving SPA + API on one port. CSP disabled so
 *                the SPA can execute its Vite-PWA bootstrap scripts.
 *
 * Selection:
 *  1. `SERVER_MODE=railway|replit` wins if set.
 *  2. Otherwise, presence of `REPLIT_DEV_DOMAIN` or `REPLIT_DOMAINS` → `replit`.
 *  3. Default → `railway`.
 */
type ServerMode = "railway" | "replit";

function detectMode(): ServerMode {
  const raw = process.env.SERVER_MODE?.trim().toLowerCase();
  if (raw === "railway" || raw === "replit") return raw;
  if (process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS) {
    return "replit";
  }
  return "railway";
}

const mode = detectMode();
const isReplit = mode === "replit";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface ServerConfig {
  mode: ServerMode;
  role: ServerMode;
  port: number;
  servesFrontend: boolean;
  distPath: string | null;
  trustProxy: number | undefined;
}

/**
 * Frozen runtime config consumed by `server/index.js` and `server/app.js`.
 * Preserves the exact behavior of the previous split entrypoints
 * (`railway.mjs` vs `replit.mjs`):
 *  - Railway: port 3000, trust proxy level 1, API-only, strict CSP.
 *  - Replit:  port 5000, no trust proxy, serves built SPA from ../dist, CSP off.
 */
export const config: Readonly<ServerConfig> = Object.freeze({
  mode,
  role: mode,
  port: Number(process.env.PORT) || (isReplit ? 5000 : 3000),
  servesFrontend: isReplit,
  distPath: isReplit ? join(__dirname, "..", "dist") : null,
  // Railway terminates TLS upstream — needs trust proxy so `req.ip` is real.
  // Replit historically did not set it; we preserve that to keep behavior stable.
  trustProxy: isReplit ? undefined : 1,
});
