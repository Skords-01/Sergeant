import { describe, expect, it } from "vitest";

/**
 * Розширене покриття `parseDeepLink()` — edge-кейси, які `src/index.test.ts`
 * не тестує (trailing slash, multi-segment paths, URL-encoded chars,
 * empty / root paths тощо). Крадькома від нативного Capacitor-рантайму:
 * сама функція не тягне `@capacitor/app`, тому тест живе в node-env без
 * будь-яких моків.
 */

import { DEEP_LINK_HTTPS_HOSTS, parseDeepLink } from "../index.js";

describe("parseDeepLink — розширені edge-кейси", () => {
  describe("валідні варіанти", () => {
    it.each([
      ["com.sergeant.shell://home", "/home"],
      ["com.sergeant.shell:///home", "/home"],
      ["com.sergeant.shell://nutrition/scan", "/nutrition/scan"],
      [
        "com.sergeant.shell://finyk/transactions/123",
        "/finyk/transactions/123",
      ],
    ])("витягає path з %s → %s", (url, expected) => {
      expect(parseDeepLink(url)).toBe(expected);
    });

    it("зберігає trailing slash як окремий сегмент (`/home/`)", () => {
      // React Router трактує `/home` і `/home/` трохи по-різному
      // (trailing slash → матч по `children` префіксу у деяких
      // конфігураціях). Навмисно НЕ стрипаємо — не наша справа
      // інтерпретувати, це робота роутера на web-стороні.
      expect(parseDeepLink("com.sergeant.shell://home/")).toBe("/home/");
    });

    it("зберігає query string як є", () => {
      expect(parseDeepLink("com.sergeant.shell://search?q=protein")).toBe(
        "/search?q=protein",
      );
    });

    it("зберігає кілька query-параметрів", () => {
      expect(
        parseDeepLink("com.sergeant.shell://search?q=protein&sort=date&n=5"),
      ).toBe("/search?q=protein&sort=date&n=5");
    });

    it("зберігає URL-encoded символи у query без повторного декодування", () => {
      // Якщо b щось деклогодилось, `?q=hello world` ламав би парсер
      // query-string React Router-а на пробілі.
      expect(parseDeepLink("com.sergeant.shell://search?q=hello%20world")).toBe(
        "/search?q=hello%20world",
      );
    });

    it("зберігає fragment (`#frag`)", () => {
      expect(parseDeepLink("com.sergeant.shell://routine#habits")).toBe(
        "/routine#habits",
      );
    });

    it("зберігає fragment разом з query (`?x=1#frag`)", () => {
      expect(parseDeepLink("com.sergeant.shell://routine?x=1#habits")).toBe(
        "/routine?x=1#habits",
      );
    });

    it("віддає `/` для порожнього path-у (`com.sergeant.shell://`)", () => {
      // Android `am start -d com.sergeant.shell://` технічно валідний —
      // трактуємо як «відкрий home».
      expect(parseDeepLink("com.sergeant.shell://")).toBe("/");
    });

    it("нормалізує потрійний слеш (`com.sergeant.shell:///`) у `/`", () => {
      expect(parseDeepLink("com.sergeant.shell:///")).toBe("/");
    });

    it("зберігає тільки query без path (`?x=1`)", () => {
      expect(parseDeepLink("com.sergeant.shell://?x=1")).toBe("/?x=1");
    });

    it("зберігає тільки fragment без path (`#frag`)", () => {
      expect(parseDeepLink("com.sergeant.shell://#frag")).toBe("/#frag");
    });
  });

  describe("відхилення чужих URL (повертає `null`)", () => {
    it.each([
      "https://sergeant.app/home", // не наш домен
      "http://sergeant.vercel.app/home", // http — явно відхиляємо
      "https://evil.com/home",
      "https://sergeant.vercel.app.evil.com/home", // suffix-attack
      "https://evil.com.sergeant.vercel.app@phish.com/home", // userinfo-injection (`host` = phish.com)
      "foo://home",
      "com.sergeant.app://home", // RN bundle id — навмисно інший
      "com.sergeant.shel://home", // typo в схемі
      "com.sergeant.shells://home", // надлишкова `s`
      "COM.SERGEANT.SHELL://home", // case-sensitive
      "//com.sergeant.shell://home", // префіксний noise
      " com.sergeant.shell://home", // leading whitespace
      "",
      "about:blank",
      "javascript:alert(1)", // захист від injection через intent
    ])("повертає `null` для `%s`", (url) => {
      expect(parseDeepLink(url)).toBeNull();
    });
  });

  describe("HTTPS Universal / App Links", () => {
    it("експонує список дозволених хостів для синхронізації з manifest / AASA", () => {
      // Smoke-guard: якщо хтось перейменує чи винесе список, тест-файл
      // fail-ить відразу і нагадує оновити AndroidManifest + AASA.
      expect(DEEP_LINK_HTTPS_HOSTS).toEqual([
        "sergeant.vercel.app",
        "sergeant.2dmanager.com.ua",
      ]);
    });

    it.each([
      ["https://sergeant.vercel.app/home", "/home"],
      ["https://sergeant.2dmanager.com.ua/home", "/home"],
      ["https://sergeant.vercel.app/nutrition/scan", "/nutrition/scan"],
      [
        "https://sergeant.2dmanager.com.ua/finyk/transactions/123",
        "/finyk/transactions/123",
      ],
    ])("витягає path з %s → %s", (url, expected) => {
      expect(parseDeepLink(url)).toBe(expected);
    });

    it("повертає `/` для кореня HTTPS URL (без path)", () => {
      expect(parseDeepLink("https://sergeant.vercel.app")).toBe("/");
      expect(parseDeepLink("https://sergeant.vercel.app/")).toBe("/");
    });

    it("зберігає trailing slash у HTTPS варіанті (`/home/`)", () => {
      expect(parseDeepLink("https://sergeant.vercel.app/home/")).toBe("/home/");
    });

    it("зберігає query-string у HTTPS варіанті", () => {
      expect(
        parseDeepLink("https://sergeant.vercel.app/search?q=protein&n=5"),
      ).toBe("/search?q=protein&n=5");
    });

    it("зберігає URL-encoded символи у query HTTPS варіанті", () => {
      expect(
        parseDeepLink("https://sergeant.vercel.app/search?q=hello%20world"),
      ).toBe("/search?q=hello%20world");
    });

    it("зберігає fragment у HTTPS варіанті", () => {
      expect(
        parseDeepLink("https://sergeant.2dmanager.com.ua/routine#habits"),
      ).toBe("/routine#habits");
    });

    it("приймає host у різному регістрі (case-insensitive)", () => {
      // Android Intent іноді нормалізує host у lowercase, iOS — нерідко
      // зберігає original-case. `new URL()` тримає host як є, тож порівняння
      // обовʼязково має бути case-insensitive (RFC 3986 §3.2.2).
      expect(parseDeepLink("https://Sergeant.Vercel.App/home")).toBe("/home");
      expect(parseDeepLink("https://SERGEANT.VERCEL.APP/home")).toBe("/home");
    });

    it("ігнорує :port як частину host-matching — :443 не губить match", () => {
      // Default port 443 для https — `new URL().host` повертає без `:443`.
      expect(parseDeepLink("https://sergeant.vercel.app:443/home")).toBe(
        "/home",
      );
    });

    it("ненаш HTTPS-порт (з non-default) трактуємо як інший host", () => {
      // `new URL("https://sergeant.vercel.app:8443/x").host` = `sergeant.vercel.app:8443`.
      // Для App Links це нерелевантно (Android не бʼє по port), але з точки
      // зору нашого коду — це інший host, strict-reject.
      expect(parseDeepLink("https://sergeant.vercel.app:8443/home")).toBeNull();
    });

    it("відхиляє http:// навіть для нашого host (ніяких cleartext deep link-ів)", () => {
      expect(parseDeepLink("http://sergeant.vercel.app/home")).toBeNull();
      expect(parseDeepLink("http://sergeant.2dmanager.com.ua/home")).toBeNull();
    });

    it("відхиляє суб-домени нашого домена як fail-closed", () => {
      // Якщо колись зʼявиться `api.sergeant.vercel.app` — це має бути
      // свідомо додано до DEEP_LINK_HTTPS_HOSTS, а не мовчки прийнято.
      expect(parseDeepLink("https://api.sergeant.vercel.app/home")).toBeNull();
      expect(parseDeepLink("https://www.sergeant.vercel.app/home")).toBeNull();
    });

    it("відхиляє malformed URL (invalid constructor input)", () => {
      expect(parseDeepLink("https://")).toBeNull();
      expect(parseDeepLink("https:///home")).toBeNull(); // empty host
    });
  });
});
