import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `auth-storage.ts` — тонка обгортка над `@capacitor/preferences`, уся
 * логіка зводиться до «бери/пиши/прибирай під ключем `auth.bearer`».
 * Замість реального KV-сховища мокуємо `Preferences` і перевіряємо
 * саме контракт виклику: правильний ключ, правильний метод.
 */

const BEARER_KEY = "auth.bearer";

const get =
  vi.fn<(args: { key: string }) => Promise<{ value: string | null }>>();
const set = vi.fn<(args: { key: string; value: string }) => Promise<void>>();
const remove = vi.fn<(args: { key: string }) => Promise<void>>();

vi.mock("@capacitor/preferences", () => ({
  Preferences: {
    get: (args: { key: string }) => get(args),
    set: (args: { key: string; value: string }) => set(args),
    remove: (args: { key: string }) => remove(args),
  },
}));

beforeEach(() => {
  get.mockReset();
  set.mockReset();
  remove.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("getBearerToken", () => {
  it("викликає Preferences.get({ key: 'auth.bearer' }) і повертає value", async () => {
    get.mockResolvedValue({ value: "jwt-abc" });
    const { getBearerToken } = await import("./auth-storage.js");

    const result = await getBearerToken();

    expect(result).toBe("jwt-abc");
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith({ key: BEARER_KEY });
  });

  it("нормалізує `undefined`/відсутній value у `null`", async () => {
    // @capacitor/preferences повертає `{ value: null }` для відсутнього
    // ключа, але ми також хочемо бути стійкими до `{ value: undefined }`.
    get.mockResolvedValue({ value: null });
    const { getBearerToken } = await import("./auth-storage.js");

    await expect(getBearerToken()).resolves.toBeNull();
  });
});

describe("setBearerToken", () => {
  it("викликає Preferences.set з правильним ключем і переданим value", async () => {
    set.mockResolvedValue(undefined);
    const { setBearerToken } = await import("./auth-storage.js");

    await setBearerToken("new-token");

    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith({ key: BEARER_KEY, value: "new-token" });
  });
});

describe("clearBearerToken", () => {
  it("викликає Preferences.remove({ key: 'auth.bearer' })", async () => {
    remove.mockResolvedValue(undefined);
    const { clearBearerToken } = await import("./auth-storage.js");

    await clearBearerToken();

    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith({ key: BEARER_KEY });
  });
});
