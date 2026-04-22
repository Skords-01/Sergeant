/**
 * Native-shell bootstrap для Capacitor WebView.
 *
 * Цей модуль — єдине місце, де **compile-time** імпортуються рантайм-плагіни
 * `@capacitor/status-bar`, `@capacitor/splash-screen`, `@capacitor/keyboard`,
 * `@capacitor/app`. Браузерні користувачі це дерево ніколи не тягнуть — веб
 * (`apps/web`) імпортує цей файл **динамічно** і лише якщо `isCapacitor()`
 * (див. `packages/shared/src/lib/platform.ts`). Vite через це виносить
 * плагіни в окремий chunk, і точка входу бандлу лишається вільною від
 * Capacitor-runtime.
 *
 * `initNativeShell()` ідемпотентний — друге-трете викликання мовчки
 * ігнорується, щоби HMR у Capacitor LiveReload не дублював listener-и
 * (`App.addListener('appUrlOpen', ...)` інакше зростає на кожному ре-імпорті).
 *
 * Deep-link bridge: `appUrlOpen` парситься через `parseDeepLink()` і
 * диспатчиться у web-шар БЕЗ compile-time залежності — через namespaced
 * `window.__sergeantShellNavigate` (виставляється React-компонентом після
 * маунту роутера) з буфером `window.__sergeantShellDeepLinkQueue` для
 * cold-start сценарію, коли native-подія прилетіла ДО того, як веб встиг
 * зареєструвати bridge. Web-сторона програє буфер при install-і.
 */

import { App, type URLOpenListenerEvent } from "@capacitor/app";
import { Keyboard, KeyboardResize } from "@capacitor/keyboard";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";

/** Колір status bar-а у light-темі — збігається з `--c-bg` (#fdf9f3). */
const STATUS_BAR_COLOR_LIGHT = "#fdf9f3";
/** Колір status bar-а у dark-темі — збігається з `.dark --c-bg` (#171412). */
const STATUS_BAR_COLOR_DARK = "#171412";

/** Custom deep-link scheme, оголошений в `AndroidManifest.xml` і `iOS Info.plist`. */
const DEEP_LINK_SCHEME = "com.sergeant.shell://";

/**
 * HTTPS-хости, які shell приймає як Universal Links (iOS) / App Links
 * (Android). Має збігатись з:
 *   - `<data android:host="..." />` у `AndroidManifest.xml`;
 *   - `applinks:<host>` в iOS entitlements `com.apple.developer.associated-domains`;
 *   - `applinks.details[].appIDs` у `/.well-known/apple-app-site-association` цього хоста;
 *   - `target.package_name` у `/.well-known/assetlinks.json` цього хоста.
 *
 * Список синхронізований з `docs/mobile.md` (секція CORS — «prod»-хости):
 *   - `sergeant.vercel.app` — Vercel-preview і прод-дефолт;
 *   - `sergeant.2dmanager.com.ua` — кастомний prod-домен.
 *
 * Кожен хост валідується строго (case-insensitive host match), без
 * suffix-wildcard, щоби `sergeant.vercel.app.evil.com` не проходив як
 * наш deep link.
 */
export const DEEP_LINK_HTTPS_HOSTS: readonly string[] = Object.freeze([
  "sergeant.vercel.app",
  "sergeant.2dmanager.com.ua",
]);

export interface InitNativeShellOptions {
  /**
   * Хук навігації з web-side (зазвичай обгортка над React Router
   * `navigate()`). Викликається з відносним шляхом, витягнутим з
   * `com.sergeant.shell://<path>`. Якщо не передано — deep-link
   * диспатчиться через window-bridge (`__sergeantShellNavigate`) з
   * буферизацією у `__sergeantShellDeepLinkQueue` для cold-start.
   */
  navigate?: (path: string) => void;
}

/**
 * Ключ на `window`, який виставляє React-компонент веб-шару (`useNavigate()`
 * обгортка) після маунту роутера. Shell викликає його, щоби програмно
 * навігувати по React Router без full-reload.
 */
const SHELL_NAVIGATE_KEY = "__sergeantShellNavigate" as const;

/**
 * Буфер deep-link шляхів, що прилетіли ДО того, як web-шар встиг виставити
 * `__sergeantShellNavigate` (cold start через deep link). Веб при install-і
 * drain-ить цей масив і програє накопичені шляхи через React Router.
 */
const SHELL_QUEUE_KEY = "__sergeantShellDeepLinkQueue" as const;

type DeepLinkBridgeWindow = Window & {
  [SHELL_NAVIGATE_KEY]?: (path: string) => void;
  [SHELL_QUEUE_KEY]?: string[];
};

/**
 * Диспатчер deep-link шляху у web-сторону. Порядок preference:
 *   1. `options.navigate(path)` — явно переданий callback (тестова ін'єкція
 *      або legacy-caller, що сам тримає навігаційний хук).
 *   2. `window.__sergeantShellNavigate(path)` — bridge, який виставляє
 *      React-layout після маунту роутера.
 *   3. Буферизація у `window.__sergeantShellDeepLinkQueue`, якщо bridge ще
 *      не встановлений (cold-start) — веб drain-ить чергу при install-і.
 *
 * Помилки виклику navigate не шкодять shell — залоговане попередження, але
 * подія все одно проковтнута (не падає з listener-у `appUrlOpen`).
 */
function dispatchDeepLink(path: string, options: InitNativeShellOptions): void {
  if (options.navigate) {
    try {
      options.navigate(path);
    } catch (err) {
      console.warn("[mobile-shell] options.navigate failed", err);
    }
    return;
  }

  if (typeof window === "undefined") return;
  const w = window as DeepLinkBridgeWindow;

  const bridgeNavigate = w[SHELL_NAVIGATE_KEY];
  if (typeof bridgeNavigate === "function") {
    try {
      bridgeNavigate(path);
    } catch (err) {
      console.warn("[mobile-shell] window.__sergeantShellNavigate failed", err);
    }
    return;
  }

  if (!Array.isArray(w[SHELL_QUEUE_KEY])) {
    w[SHELL_QUEUE_KEY] = [];
  }
  w[SHELL_QUEUE_KEY]!.push(path);
}

let initialized = false;

/**
 * Детектує dark-тему так само, як веб: або клас `.dark` на `<html>`
 * (runtime toggle), або `prefers-color-scheme: dark` як fallback.
 */
function isDarkTheme(): boolean {
  if (typeof document !== "undefined") {
    if (document.documentElement.classList.contains("dark")) return true;
  }
  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function"
  ) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  return false;
}

/**
 * Витягує шлях з deep-link URL для React Router (`/path?q=1#frag`). Приймає
 * дві форми:
 *
 *   1. **Custom scheme** — `com.sergeant.shell://<path>?q=1#frag`. Історично
 *      перший спосіб, працює без assetlinks/AASA та без chooser-діалогу
 *      тільки коли інша апка не зареєструвалась на ту саму схему
 *      (`com.sergeant.shell` достатньо унікальна).
 *   2. **HTTPS Universal / App Links** — `https://<host>/<path>?q=1#frag`
 *      для хостів з `DEEP_LINK_HTTPS_HOSTS`. Потребує валідних
 *      `.well-known/assetlinks.json` (Android) та
 *      `.well-known/apple-app-site-association` (iOS) — див.
 *      `docs/capacitor-deep-links.md`.
 *
 * Обидві форми повертають ту саму канонічну React-Router path, щоби
 * user-facing навігаційна логіка (роутер, analytics, A/B) була єдина.
 *
 * Повертає `null` для будь-чого, що не вписується у ці дві форми —
 * захист від intent-ів чужих апок (`android.intent.action.VIEW` на
 * невідому схему не повинен навігувати у нашому роутері).
 *
 * Host comparison case-insensitive (RFC 3986 §3.2.2), path/query/fragment
 * зберігаємо «як є» — не URL-decode-имо, щоби параметри з `%20`/`+`
 * дійшли до web-шару у первинній формі.
 */
export function parseDeepLink(url: string): string | null {
  if (typeof url !== "string" || url.length === 0) return null;

  if (url.startsWith(DEEP_LINK_SCHEME)) {
    const rest = url.slice(DEEP_LINK_SCHEME.length);
    // `com.sergeant.shell://home` і `com.sergeant.shell:///home` трактуємо
    // однаково — перша форма частіше генерується Android `am start`.
    return rest.startsWith("/") ? rest : `/${rest}`;
  }

  // HTTPS-варіант. Навмисно не приймаємо http:// — App Links / Universal
  // Links апрувляться тільки на https, і ми не хочемо стрільнути cleartext
  // deep link навіть у тесті.
  if (url.startsWith("https://")) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return null;
    }
    const hostLower = parsed.host.toLowerCase();
    const matchesHost = DEEP_LINK_HTTPS_HOSTS.some(
      (allowed) => allowed.toLowerCase() === hostLower,
    );
    if (!matchesHost) return null;
    // `parsed.pathname` завжди починається з `/` (у т.ч. для кореня);
    // `parsed.search` і `parsed.hash` вже з лідируючим `?` / `#` або
    // порожні рядки — об'єднуємо напряму без re-encoding.
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  }

  return null;
}

/**
 * Налаштовує native-UX (status bar, splash, keyboard, deep links).
 *
 * Безпечно викликати поза Capacitor — кожен плагін сам зробить no-op на
 * web-платформі, але ми все одно очікуємо, що виклик відбудеться лише
 * з guard-у `isCapacitor()`, щоб не тягнути цей chunk у браузер.
 */
export async function initNativeShell(
  options: InitNativeShellOptions = {},
): Promise<void> {
  if (initialized) return;
  initialized = true;

  const dark = isDarkTheme();

  // Помилки окремих плагінів не повинні ламати інші — кожен крок у
  // try/catch з console.warn, щоб застрягнути на status bar-і і не
  // дійти до splash.hide() = чорний екран користувачу.

  try {
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
    await StatusBar.setBackgroundColor({
      color: dark ? STATUS_BAR_COLOR_DARK : STATUS_BAR_COLOR_LIGHT,
    });
  } catch (err) {
    console.warn("[mobile-shell] StatusBar config failed", err);
  }

  try {
    // Явний `hide()` з fade даємо самі — інакше splash висить до
    // `launchShowDuration` з `capacitor.config.ts` (default 500 ms) і
    // дає flash між splash і першим React-рендером.
    await SplashScreen.hide({ fadeOutDuration: 250 });
  } catch (err) {
    console.warn("[mobile-shell] SplashScreen.hide failed", err);
  }

  try {
    // `Body` режим піднімає все тіло при появі клавіатури — на iOS це
    // єдиний режим, де `position: fixed` елементи (BottomNav) не
    // заховуються під клавіатурою. На Android — no-op, WebView сам
    // ресайзить viewport.
    await Keyboard.setResizeMode({ mode: KeyboardResize.Body });
  } catch (err) {
    console.warn("[mobile-shell] Keyboard.setResizeMode failed", err);
  }

  try {
    await App.addListener("appUrlOpen", (event: URLOpenListenerEvent) => {
      const path = parseDeepLink(event.url);
      if (path == null) return;
      dispatchDeepLink(path, options);
    });
  } catch (err) {
    console.warn("[mobile-shell] App.addListener('appUrlOpen') failed", err);
  }

  try {
    // Апаратна кнопка "Назад" на Android: Capacitor default — `App.exitApp()`
    // на першому ж натисканні, що для SPA виглядає як «апка раптом закрилась».
    // Очікувана Android UX — пройтись назад по web-history, і лише коли
    // стек порожній — вийти. Свідомо використовуємо `window.history.back()`,
    // а не `options.navigate` хук: back-button — це pure history traversal
    // (React Router сам слухає `popstate`), тоді як `navigate()` робить
    // `push` і плутає з deep-link кейсом, де URL «прибігає збоку» ззовні.
    await App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) {
        if (typeof window !== "undefined") {
          window.history.back();
        }
      } else {
        void App.exitApp();
      }
    });
  } catch (err) {
    console.warn("[mobile-shell] App.addListener('backButton') failed", err);
  }
}
