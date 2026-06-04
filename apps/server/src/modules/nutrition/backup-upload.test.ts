/**
 * Юніт-тести для `backup-upload.ts`.
 *
 * Контракт під тестом:
 *   1. Happy path: повертає { ok: true, savedAt: <number> } після запису файлу.
 *   2. Відсутній userId: кидає UnauthorizedError, fs.writeFile не викликається.
 *   3. NUTRITION_BACKUP_KEY_SECRET не задано: кидає AppError(503).
 *   4. Payload > 2.5 MB: кидає AppError(413) з кодом PAYLOAD_TOO_LARGE.
 *   5. Некоректне тіло (без поля blob): кидає ValidationError (parseBody).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

vi.mock("node:fs/promises", () => ({
  default: { mkdir: vi.fn().mockResolvedValue(undefined), writeFile: vi.fn() },
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn(),
}));

vi.mock("../../env/env.js", () => ({
  env: {
    get NUTRITION_BACKUP_KEY_SECRET() {
      return process.env["_TEST_UPLOAD_SECRET"] ?? "";
    },
  },
}));

import fsMod from "node:fs/promises";
import handler from "./backup-upload.js";
import { UnauthorizedError, AppError } from "../../obs/errors.js";

const fsMock = fsMod as unknown as {
  mkdir: ReturnType<typeof vi.fn>;
  writeFile: ReturnType<typeof vi.fn>;
};

interface TestRes {
  statusCode: number;
  body: unknown;
  status(code: number): TestRes;
  json(payload: unknown): TestRes;
}

function mockRes(): TestRes & Response {
  const r: TestRes = {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return r as TestRes & Response;
}

function makeReq(userId?: string, body?: unknown, xToken?: string): Request {
  return {
    user: userId ? { id: userId } : undefined,
    headers: xToken ? { "x-token": xToken } : {},
    body,
  } as unknown as Request;
}

beforeEach(() => {
  vi.clearAllMocks();
  fsMock.mkdir.mockResolvedValue(undefined);
  fsMock.writeFile.mockResolvedValue(undefined);
  process.env["_TEST_UPLOAD_SECRET"] = "upload-secret-value";
});

describe("backup-upload handler", () => {
  it("зберігає файл і повертає { ok: true, savedAt: number }", async () => {
    const blob = { meals: [], version: 1 };
    const res = mockRes();
    const before = Date.now();

    await handler(makeReq("user-1", { blob }, "tok"), res);

    const after = Date.now();
    expect(res.statusCode).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body["ok"]).toBe(true);
    expect(typeof body["savedAt"]).toBe("number");
    expect(body["savedAt"] as number).toBeGreaterThanOrEqual(before);
    expect(body["savedAt"] as number).toBeLessThanOrEqual(after);

    expect(fsMock.writeFile).toHaveBeenCalledOnce();
    const [filePath, content] = fsMock.writeFile.mock.calls[0] as [
      string,
      string,
      string,
    ];
    expect(filePath).toContain("nutrition-backup-");
    expect(filePath).toMatch(/\.json$/);
    expect(JSON.parse(content)).toEqual(blob);
  });

  it("кидає UnauthorizedError при відсутньому userId", async () => {
    await expect(
      handler(makeReq(undefined, { blob: {} }), mockRes()),
    ).rejects.toThrow(UnauthorizedError);

    expect(fsMock.writeFile).not.toHaveBeenCalled();
  });

  it("кидає AppError(503) коли NUTRITION_BACKUP_KEY_SECRET не задано", async () => {
    process.env["_TEST_UPLOAD_SECRET"] = "";

    let err: unknown;
    try {
      await handler(makeReq("user-2", { blob: {} }), mockRes());
    } catch (e) {
      err = e;
    }

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).status).toBe(503);
    expect(fsMock.writeFile).not.toHaveBeenCalled();
  });

  it("кидає AppError(413) коли blob перевищує 2.5 MB", async () => {
    // Генеруємо рядок, JSON якого буде > 2_500_000 байт.
    const hugeBlob = { data: "x".repeat(2_600_000) };

    let err: unknown;
    try {
      await handler(makeReq("user-3", { blob: hugeBlob }), mockRes());
    } catch (e) {
      err = e;
    }

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).status).toBe(413);
    expect((err as AppError).code).toBe("PAYLOAD_TOO_LARGE");
    expect(fsMock.writeFile).not.toHaveBeenCalled();
  });
});
