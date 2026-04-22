import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Тонка обгортка над `@capacitor/core`.Capacitor — весь тест зводиться до
 * того, щоб `isCapacitor()` чесно проксі-викликав `isNativePlatform()`, а
 * `getPlatform()` нормалізував `getPlatform()` до вузького union-а
 * `'web' | 'ios' | 'android'` (усе, що не `ios`/`android` → `web`).
 */

const isNativePlatform = vi.fn<() => boolean>();
const getPlatform = vi.fn<() => string>();

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => isNativePlatform(),
    getPlatform: () => getPlatform(),
  },
}));

beforeEach(() => {
  vi.resetModules();
  isNativePlatform.mockReset();
  getPlatform.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("isCapacitor", () => {
  it("повертає true, коли Capacitor.isNativePlatform() = true", async () => {
    isNativePlatform.mockReturnValue(true);
    const mod = await import("./platform.js");
    expect(mod.isCapacitor()).toBe(true);
    expect(isNativePlatform).toHaveBeenCalledTimes(1);
  });

  it("повертає false, коли Capacitor.isNativePlatform() = false", async () => {
    isNativePlatform.mockReturnValue(false);
    const mod = await import("./platform.js");
    expect(mod.isCapacitor()).toBe(false);
  });
});

describe("getPlatform", () => {
  it.each([
    ["ios", "ios"],
    ["android", "android"],
  ] as const)(
    "проксі-викликає Capacitor.getPlatform() і повертає %s як %s",
    async (input, expected) => {
      getPlatform.mockReturnValue(input);
      const mod = await import("./platform.js");
      expect(mod.getPlatform()).toBe(expected);
    },
  );

  it.each(["web", "windows", "macos", "", "unknown"])(
    "нормалізує невідоме значення (%s) у 'web'",
    async (input) => {
      getPlatform.mockReturnValue(input);
      const mod = await import("./platform.js");
      expect(mod.getPlatform()).toBe("web");
    },
  );
});
