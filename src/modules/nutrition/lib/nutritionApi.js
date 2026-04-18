import { ApiError, httpRequest } from "@shared/api/client.js";
import { friendlyApiError } from "./nutritionErrors.js";

export async function postJson(url, body) {
  const token =
    typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_NUTRITION_API_TOKEN
      ? String(import.meta.env.VITE_NUTRITION_API_TOKEN)
      : "";
  try {
    return await httpRequest(url, {
      method: "POST",
      headers: {
        ...(token ? { "X-Token": token } : {}),
      },
      body: body || {},
    });
  } catch (err) {
    if (!navigator.onLine) {
      throw new Error("Немає підключення до інтернету. Спробуй пізніше.");
    }
    if (err instanceof ApiError) {
      throw new Error(friendlyApiError(err.status, err?.data?.error || err.message));
    }
    throw new Error(err?.message || "Не вдалося зʼєднатися із сервером.");
  }
}
