import { friendlyApiError } from "./nutritionErrors.js";

export async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  const raw = await res.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    // Частий кейс на Vercel: /api/* перехоплено rewrite і повернувся index.html
    if (ct.includes("text/html") || /<!doctype html/i.test(raw)) {
      throw new Error(
        "API повернув HTML замість JSON (ймовірно, rewrite перехоплює /api/*).",
      );
    }
    data = { error: raw || "Некоректна відповідь сервера" };
  }
  if (!res.ok) throw new Error(friendlyApiError(res.status, data?.error));
  return data;
}

