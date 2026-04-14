/**
 * Базовий URL для API. На Vercel порожньо → відносні шляхи `/api/*`.
 * Для окремого бекенду (Railway тощо): `VITE_API_BASE_URL=https://....up.railway.app`
 */
export function apiUrl(path) {
  const raw =
    typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL
      ? String(import.meta.env.VITE_API_BASE_URL).trim()
      : "http://localhost:3000";
  const base = raw.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}
