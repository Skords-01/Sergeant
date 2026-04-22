// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Для `initNativeShell()` ми тестуємо лише композицію: що кожен з чотирьох
 * Capacitor-плагінів був викликаний з правильними аргументами, що помилка
 * одного не ламає інші, що виклик ідемпотентний і що `appUrlOpen` listener
 * коректно маршрутизує deep-link. Реальний native-рантайм тут не потрібен.
 *
 * Мокуємо через `vi.doMock` (не `vi.mock`) — чистимо й перевстановлюємо
 * моки в `beforeEach`, а модуль імпортуємо динамічно після налаштування
 * моків. Це дозволяє скинути module-level `initialized` прапор між тестами
 * через `vi.resetModules()`.
 */

type CapacitorMocks = {
  StatusBar: {
    setStyle: ReturnType<typeof vi.fn>;
    setBackgroundColor: ReturnType<typeof vi.fn>;
  };
  SplashScreen: { hide: ReturnType<typeof vi.fn> };
  Keyboard: { setResizeMode: ReturnType<typeof vi.fn> };
  App: { addListener: ReturnType<typeof vi.fn> };
};

type UrlOpenCallback = (event: { url: string }) => void;

function installCapacitorMocks(): CapacitorMocks {
  const StatusBar = {
    setStyle: vi.fn().mockResolvedValue(undefined),
    setBackgroundColor: vi.fn().mockResolvedValue(undefined),
  };
  const SplashScreen = { hide: vi.fn().mockResolvedValue(undefined) };
  const Keyboard = { setResizeMode: vi.fn().mockResolvedValue(undefined) };
  const App = {
    addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
  };

  vi.doMock("@capacitor/status-bar", () => ({
    StatusBar,
    Style: { Dark: "DARK", Light: "LIGHT", Default: "DEFAULT" },
  }));
  vi.doMock("@capacitor/splash-screen", () => ({ SplashScreen }));
  vi.doMock("@capacitor/keyboard", () => ({
    Keyboard,
    KeyboardResize: {
      Body: "body",
      Ionic: "ionic",
      Native: "native",
      None: "none",
    },
  }));
  vi.doMock("@capacitor/app", () => ({ App }));

  return { StatusBar, SplashScreen, Keyboard, App };
}

beforeEach(() => {
  vi.resetModules();
  document.documentElement.classList.remove("dark");
});

afterEach(() => {
  vi.doUnmock("@capacitor/status-bar");
  vi.doUnmock("@capacitor/splash-screen");
  vi.doUnmock("@capacitor/keyboard");
  vi.doUnmock("@capacitor/app");
  vi.restoreAllMocks();
});

describe("parseDeepLink", () => {
  it("повертає `/home` для `com.sergeant.shell://home`", async () => {
    installCapacitorMocks();
    const { parseDeepLink } = await import("./index.js");
    expect(parseDeepLink("com.sergeant.shell://home")).toBe("/home");
  });

  it("зберігає query+hash: `/home?x=1#frag`", async () => {
    installCapacitorMocks();
    const { parseDeepLink } = await import("./index.js");
    expect(parseDeepLink("com.sergeant.shell://home?x=1#frag")).toBe(
      "/home?x=1#frag",
    );
  });

  it("нормалізує `com.sergeant.shell:///home` → `/home` (не дублює ведучий `/`)", async () => {
    installCapacitorMocks();
    const { parseDeepLink } = await import("./index.js");
    expect(parseDeepLink("com.sergeant.shell:///home")).toBe("/home");
  });

  it.each([
    "https://sergeant.app/home",
    "foo://home",
    "",
    "com.sergeant.shel://home", // очепятка в схемі
  ])("повертає null для `%s`", async (url) => {
    installCapacitorMocks();
    const { parseDeepLink } = await import("./index.js");
    expect(parseDeepLink(url)).toBeNull();
  });
});

describe("initNativeShell — композиція плагінів", () => {
  it("викликає StatusBar + SplashScreen + Keyboard + App.addListener з правильними аргументами (light-тема)", async () => {
    const mocks = installCapacitorMocks();
    const { initNativeShell } = await import("./index.js");

    await initNativeShell();

    expect(mocks.StatusBar.setStyle).toHaveBeenCalledTimes(1);
    expect(mocks.StatusBar.setStyle).toHaveBeenCalledWith({ style: "LIGHT" });
    expect(mocks.StatusBar.setBackgroundColor).toHaveBeenCalledTimes(1);
    expect(mocks.StatusBar.setBackgroundColor).toHaveBeenCalledWith({
      color: "#fdf9f3",
    });
    expect(mocks.SplashScreen.hide).toHaveBeenCalledTimes(1);
    expect(mocks.SplashScreen.hide).toHaveBeenCalledWith({
      fadeOutDuration: 250,
    });
    expect(mocks.Keyboard.setResizeMode).toHaveBeenCalledTimes(1);
    expect(mocks.Keyboard.setResizeMode).toHaveBeenCalledWith({ mode: "body" });
    expect(mocks.App.addListener).toHaveBeenCalledTimes(1);
    expect(mocks.App.addListener).toHaveBeenCalledWith(
      "appUrlOpen",
      expect.any(Function),
    );
  });

  it("у dark-темі застосовує dark style + #171412 background", async () => {
    const mocks = installCapacitorMocks();
    document.documentElement.classList.add("dark");

    const { initNativeShell } = await import("./index.js");
    await initNativeShell();

    expect(mocks.StatusBar.setStyle).toHaveBeenCalledWith({ style: "DARK" });
    expect(mocks.StatusBar.setBackgroundColor).toHaveBeenCalledWith({
      color: "#171412",
    });
  });
});

describe("initNativeShell — ідемпотентність", () => {
  it("другий і третій виклики — no-op (лічильники моків не зростають)", async () => {
    const mocks = installCapacitorMocks();
    const { initNativeShell } = await import("./index.js");

    await initNativeShell();
    await initNativeShell();
    await initNativeShell();

    expect(mocks.StatusBar.setStyle).toHaveBeenCalledTimes(1);
    expect(mocks.StatusBar.setBackgroundColor).toHaveBeenCalledTimes(1);
    expect(mocks.SplashScreen.hide).toHaveBeenCalledTimes(1);
    expect(mocks.Keyboard.setResizeMode).toHaveBeenCalledTimes(1);
    expect(mocks.App.addListener).toHaveBeenCalledTimes(1);
  });
});

describe("initNativeShell — ізоляція помилок", () => {
  it("якщо StatusBar падає, SplashScreen/Keyboard/App все одно викликаються", async () => {
    const mocks = installCapacitorMocks();
    mocks.StatusBar.setStyle.mockRejectedValueOnce(new Error("boom"));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { initNativeShell } = await import("./index.js");
    await initNativeShell();

    expect(mocks.SplashScreen.hide).toHaveBeenCalledTimes(1);
    expect(mocks.Keyboard.setResizeMode).toHaveBeenCalledTimes(1);
    expect(mocks.App.addListener).toHaveBeenCalledTimes(1);
    // StatusBar warn-повідомлення вилетіло — інакше користувач побачив би
    // лише «мовчки не спрацювало».
    expect(warnSpy).toHaveBeenCalled();
    const warnArg = warnSpy.mock.calls[0]?.[0];
    expect(String(warnArg)).toContain("StatusBar");
  });

  it("якщо SplashScreen.hide падає, App.addListener все одно реєструється", async () => {
    const mocks = installCapacitorMocks();
    mocks.SplashScreen.hide.mockRejectedValueOnce(new Error("boom"));
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { initNativeShell } = await import("./index.js");
    await initNativeShell();

    expect(mocks.App.addListener).toHaveBeenCalledTimes(1);
  });
});

describe("initNativeShell — deep-link listener", () => {
  async function captureUrlOpenCallback(
    mocks: CapacitorMocks,
    options: { navigate?: (path: string) => void } = {},
  ): Promise<UrlOpenCallback> {
    const { initNativeShell } = await import("./index.js");
    await initNativeShell(options);

    const call = mocks.App.addListener.mock.calls[0];
    expect(call?.[0]).toBe("appUrlOpen");
    const cb = call?.[1] as UrlOpenCallback;
    expect(typeof cb).toBe("function");
    return cb;
  }

  it("викликає options.navigate з витягнутим шляхом", async () => {
    const mocks = installCapacitorMocks();
    const navigate = vi.fn();

    const cb = await captureUrlOpenCallback(mocks, { navigate });
    cb({ url: "com.sergeant.shell://settings" });

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("/settings");
  });

  it("НЕ викликає navigate для чужого URL (https://…)", async () => {
    const mocks = installCapacitorMocks();
    const navigate = vi.fn();

    const cb = await captureUrlOpenCallback(mocks, { navigate });
    cb({ url: "https://example.com" });

    expect(navigate).not.toHaveBeenCalled();
  });

  it("без options.navigate — fallback на window.location.assign", async () => {
    const mocks = installCapacitorMocks();
    const assign = vi.fn();
    // `window.location.assign` у jsdom не конфігурується точково, тому
    // підміняємо весь `window.location` — цього достатньо для тесту.
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, assign },
    });

    try {
      const cb = await captureUrlOpenCallback(mocks);
      cb({ url: "com.sergeant.shell://home" });

      expect(assign).toHaveBeenCalledTimes(1);
      expect(assign).toHaveBeenCalledWith("/home");
    } finally {
      Object.defineProperty(window, "location", {
        configurable: true,
        value: originalLocation,
      });
    }
  });
});
