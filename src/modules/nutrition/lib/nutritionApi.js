import { apiUrl } from "@shared/lib/apiUrl.js";
import { friendlyApiError } from "./nutritionErrors.js";

export async function postJson(url, body) {
  const token =
    typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_NUTRITION_API_TOKEN
      ? String(import.meta.env.VITE_NUTRITION_API_TOKEN)
      : "";
  const res = await fetch(apiUrl(url), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "X-Token": token } : {}),
    },
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

