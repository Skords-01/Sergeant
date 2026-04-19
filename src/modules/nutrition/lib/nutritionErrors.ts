import { friendlyApiError as baseFriendlyApiError } from "@shared/lib/friendlyApiError";

/**
 * Nutrition-специфічний варіант `friendlyApiError`. Додає дві речі,
 * яких немає у загальному мапері:
 *  - 500 без ключа AI → окремий текст про «сервер харчування»;
 *  - 413 для завеликого фото → конкретна інструкція.
 *
 * Усе інше делегуємо у `@shared/lib/friendlyApiError` — щоб
 * 401/403/429/дефолт поводились однаково по всьому застосунку.
 */
export function friendlyApiError(
  status: number,
  message?: string | null,
): string {
  const m = message || "";
  if (status === 500 && /ANTHROPIC|not set|key/i.test(m)) {
    return "Сервер харчування не налаштовано (немає ключа AI).";
  }
  if (status === 413) {
    return "Занадто велике фото. Стисни/обріж і спробуй ще раз.";
  }
  return baseFriendlyApiError(status, message);
}
