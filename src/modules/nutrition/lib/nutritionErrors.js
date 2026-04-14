export function friendlyApiError(status, message) {
  const m = message || "";
  if (status === 500 && /ANTHROPIC|not set|key/i.test(m)) {
    return "Сервер харчування не налаштовано (немає ключа AI).";
  }
  if (status === 413) return "Занадто велике фото. Стисни/обріж і спробуй ще раз.";
  if (status === 429) return "Забагато запитів. Спробуй через хвилину.";
  if (status === 401 || status === 403) return "Доступ заборонено.";
  return m || `Помилка ${status}`;
}

