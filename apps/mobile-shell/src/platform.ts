/**
 * Runtime-детектор Capacitor-оточення.
 *
 * Експортуємо звідси, а не з `apps/web`, щоб веб не мав compile-time
 * залежності на `@capacitor/core` (і щоб bundle залишався чистим для
 * браузерного деплою). Веб може імпортувати цей файл через
 * `@sergeant/mobile-shell/platform` тільки якщо shell буде підключений
 * як dependency — зараз це не так, shell споживає веб-білд як
 * статичний артефакт.
 *
 * Для веба feature-detect-у native-середовища достатньо перевірки на
 * глобальний `window.Capacitor` (впорскується native-runtime при
 * завантаженні WebView), що дублюємо нижче — саме цей варіант і
 * раджу використовувати в `apps/web` у будь-якій гілці, що хоче
 * гілкуватися `if (isCapacitor()) { nativeImpl() } else { webImpl() }`.
 */

import { Capacitor } from "@capacitor/core";

export function isCapacitor(): boolean {
  return Capacitor.isNativePlatform();
}

export function getPlatform(): "web" | "ios" | "android" {
  const p = Capacitor.getPlatform();
  return p === "ios" || p === "android" ? p : "web";
}
