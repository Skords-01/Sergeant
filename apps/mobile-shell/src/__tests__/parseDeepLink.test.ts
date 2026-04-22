import { describe, expect, it } from "vitest";

/**
 * Розширене покриття `parseDeepLink()` — edge-кейси, які `src/index.test.ts`
 * не тестує (trailing slash, multi-segment paths, URL-encoded chars,
 * empty / root paths тощо). Крадькома від нативного Capacitor-рантайму:
 * сама функція не тягне `@capacitor/app`, тому тест живе в node-env без
 * будь-яких моків.
 */

import { parseDeepLink } from "../index.js";

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
      "https://sergeant.app/home",
      "http://sergeant.app/home",
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
});
