import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db.js", () => {
  const pool = { query: vi.fn(), connect: vi.fn() };
  return { default: pool, pool };
});

vi.mock("../obs/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import _pool from "../db.js";
import {
  _resetKeyCacheForTests,
  decryptPayload,
  deleteToken,
  encryptPayload,
  getToken,
  hasToken,
  isVaultConfigured,
  putToken,
  VaultDecryptError,
  VaultNotConfiguredError,
} from "./bankVault.js";

const pool = _pool as unknown as {
  query: ReturnType<typeof vi.fn>;
};

const VALID_KEY_HEX = "a".repeat(64); // 32 bytes of 0xaa

beforeEach(() => {
  process.env.BANK_TOKEN_ENC_KEY = VALID_KEY_HEX;
  _resetKeyCacheForTests();
  vi.clearAllMocks();
});

afterEach(() => {
  delete process.env.BANK_TOKEN_ENC_KEY;
  _resetKeyCacheForTests();
});

describe("bankVault — configuration", () => {
  it("isVaultConfigured returns true with valid hex key", () => {
    expect(isVaultConfigured()).toBe(true);
  });

  it("isVaultConfigured returns false when key is missing", () => {
    delete process.env.BANK_TOKEN_ENC_KEY;
    _resetKeyCacheForTests();
    expect(isVaultConfigured()).toBe(false);
  });

  it("encryptPayload throws VaultNotConfiguredError without key", () => {
    delete process.env.BANK_TOKEN_ENC_KEY;
    _resetKeyCacheForTests();
    expect(() => encryptPayload("x")).toThrow(VaultNotConfiguredError);
  });

  it("rejects key of wrong length", () => {
    process.env.BANK_TOKEN_ENC_KEY = "deadbeef"; // 4 bytes, not 32
    _resetKeyCacheForTests();
    expect(() => encryptPayload("x")).toThrow(/32 bytes/);
  });

  it("accepts base64-encoded key of 32 bytes", () => {
    // 32 байти 0xbb у base64
    process.env.BANK_TOKEN_ENC_KEY = Buffer.alloc(32, 0xbb).toString("base64");
    _resetKeyCacheForTests();
    expect(isVaultConfigured()).toBe(true);
    const round = decryptPayload(encryptPayload("hello"));
    expect(round).toBe("hello");
  });
});

describe("bankVault — round-trip encrypt/decrypt", () => {
  it("encrypts then decrypts to the same plaintext", () => {
    const enc = encryptPayload("monobank-personal-token-abc123");
    expect(enc.ciphertext).toBeInstanceOf(Buffer);
    expect(enc.iv.length).toBe(12);
    expect(enc.auth_tag.length).toBe(16);
    expect(enc.key_id).toBe("v1");
    expect(decryptPayload(enc)).toBe("monobank-personal-token-abc123");
  });

  it("produces different ciphertexts for same plaintext (unique IV)", () => {
    const a = encryptPayload("same-plaintext");
    const b = encryptPayload("same-plaintext");
    expect(a.iv.equals(b.iv)).toBe(false);
    expect(a.ciphertext.equals(b.ciphertext)).toBe(false);
    expect(decryptPayload(a)).toBe("same-plaintext");
    expect(decryptPayload(b)).toBe("same-plaintext");
  });

  it("decrypt fails on tampered ciphertext", () => {
    const enc = encryptPayload("secret");
    const tampered = {
      ...enc,
      ciphertext: Buffer.concat([
        enc.ciphertext.subarray(0, -1),
        Buffer.from([0x00]),
      ]),
    };
    expect(() => decryptPayload(tampered)).toThrow(VaultDecryptError);
  });

  it("decrypt fails on tampered auth tag", () => {
    const enc = encryptPayload("secret");
    const tampered = { ...enc, auth_tag: Buffer.alloc(16, 0) };
    expect(() => decryptPayload(tampered)).toThrow(VaultDecryptError);
  });

  it("decrypt fails on unknown key_id", () => {
    const enc = encryptPayload("secret");
    expect(() => decryptPayload({ ...enc, key_id: "v99" })).toThrow(
      /unknown key_id/,
    );
  });

  it("decrypt fails if key changed between encrypt and decrypt", () => {
    const enc = encryptPayload("secret");
    process.env.BANK_TOKEN_ENC_KEY = "b".repeat(64); // different key
    _resetKeyCacheForTests();
    expect(() => decryptPayload(enc)).toThrow(VaultDecryptError);
  });
});

describe("bankVault — putToken / getToken / deleteToken / hasToken", () => {
  it("putToken issues UPSERT INSERT with ciphertext and GCM params", async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [] });
    await putToken("user-1", "monobank", "mono-token-xyz");
    expect(pool.query).toHaveBeenCalledTimes(1);
    const [[sql, params]] = pool.query.mock.calls;
    expect(sql).toMatch(/INSERT INTO bank_tokens/);
    expect(sql).toMatch(/ON CONFLICT \(user_id, provider\)/);
    expect(params[0]).toBe("user-1");
    expect(params[1]).toBe("monobank");
    expect(params[2]).toBeInstanceOf(Buffer); // ciphertext
    expect(params[3]).toBeInstanceOf(Buffer); // iv
    expect((params[3] as Buffer).length).toBe(12);
    expect(params[4]).toBeInstanceOf(Buffer); // auth_tag
    expect((params[4] as Buffer).length).toBe(16);
    expect(params[5]).toBe("v1");
  });

  it("getToken returns null when no row", async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    const result = await getToken("user-1", "monobank");
    expect(result).toBeNull();
  });

  it("getToken returns decrypted plaintext for stored row", async () => {
    const enc = encryptPayload("mono-token-xyz");
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [enc],
    });
    const result = await getToken("user-1", "monobank");
    expect(result).toBe("mono-token-xyz");
  });

  it("getToken returns null (not throw) when decrypt fails", async () => {
    const enc = encryptPayload("mono-token");
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ ...enc, auth_tag: Buffer.alloc(16, 0) }],
    });
    const result = await getToken("user-1", "monobank");
    expect(result).toBeNull();
  });

  it("deleteToken returns true when row deleted", async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [] });
    const removed = await deleteToken("user-1", "monobank");
    expect(removed).toBe(true);
  });

  it("deleteToken returns false when no row", async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    const removed = await deleteToken("user-1", "monobank");
    expect(removed).toBe(false);
  });

  it("hasToken returns true/false based on row existence", async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ present: true }],
    });
    expect(await hasToken("user-1", "monobank")).toBe(true);

    pool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    expect(await hasToken("user-1", "monobank")).toBe(false);
  });
});
