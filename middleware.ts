/**
 * Vercel Edge Middleware — проксіює `/api/*` запити на бекенд (Railway).
 *
 * Safari (ITP) блокує third-party cookie, коли фронт і API на різних доменах
 * (sergeant.vercel.app ↔ sergeant-production.up.railway.app). Проксі робить
 * cookie same-origin — Safari їх зберігає.
 *
 * Конфігурація:
 *   - `BACKEND_URL` (Vercel env) — base URL бекенду, напр.
 *     `https://sergeant-production.up.railway.app`. Без неї middleware — no-op
 *     (запити проходять далі без проксі, що зручно для dev-режимів, де API
 *     подається Vite proxy або тим самим процесом).
 */

export const config = {
  matcher: "/api/:path*",
};

export default async function middleware(
  request: Request,
): Promise<Response | undefined> {
  const backend = process.env.BACKEND_URL;
  if (!backend) return undefined;

  const url = new URL(request.url);
  const target = new URL(`${backend}${url.pathname}${url.search}`);

  const headers = new Headers(request.headers);
  headers.set("x-forwarded-host", url.host);
  headers.set("x-forwarded-proto", url.protocol.replace(":", ""));

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const body = hasBody ? await request.arrayBuffer() : undefined;

  return fetch(target.toString(), {
    method: request.method,
    headers,
    body,
  });
}
