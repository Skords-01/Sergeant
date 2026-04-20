/**
 * Базовий URL для API.
 * - `VITE_API_BASE_URL` задано → прямий URL (прод на Railway тощо).
 * - Інакше → відносні шляхи `/api/*` (локально Vite проксує на бекенд, див. vite.config).
 */
export function apiUrl(path: string): string {
  const raw =
    typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL
      ? String(import.meta.env.VITE_API_BASE_URL).trim()
      : "";
  const base = raw.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}
