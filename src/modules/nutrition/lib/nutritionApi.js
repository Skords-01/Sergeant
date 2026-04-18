import { nutritionApi, isApiError } from "@shared/api";
import { friendlyApiError } from "./nutritionErrors.js";

/**
 * Тонкий адаптер над централізованим `nutritionApi.postJson`:
 * зберігає старий контракт (`throw new Error(friendlyApiError(...))`),
 * щоб хуки nutrition-модуля не потребували переписування.
 */
export async function postJson(url, body) {
  try {
    return await nutritionApi.postJson(url, body);
  } catch (err) {
    if (!isApiError(err)) {
      throw new Error(err?.message || "Не вдалося зʼєднатися із сервером.");
    }
    if (err.kind === "network") {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        throw new Error("Немає підключення до інтернету. Спробуй пізніше.");
      }
      throw new Error(err.message || "Не вдалося зʼєднатися із сервером.");
    }
    if (err.kind === "parse") {
      // Частий кейс на Vercel: /api/* перехоплено rewrite і повернувся index.html
      if (/<!doctype html/i.test(err.bodyText || "")) {
        throw new Error(
          "API повернув HTML замість JSON (ймовірно, rewrite перехоплює /api/*).",
        );
      }
      throw new Error(err.bodyText || "Некоректна відповідь сервера");
    }
    // kind === "http" або "aborted"
    throw new Error(friendlyApiError(err.status, err.serverMessage));
  }
}
