import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response } from "express";

vi.mock("@sentry/node", () => {
  return {
    captureException: vi.fn(),
  };
});

import * as Sentry from "@sentry/node";
import { errorHandler } from "./errorHandler.js";
import { AppError } from "../obs/errors.js";

function makeReqRes() {
  const headers: Record<string, string> = {};
  return {
    req: {
      method: "POST",
      originalUrl: "/api/x",
      requestId: "req_1",
    } as unknown as Request,
    res: {
      statusCode: 200,
      body: undefined as unknown,
      headersSent: false,
      setHeader(name: string, value: string) {
        headers[name] = value;
      },
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: unknown) {
        this.body = payload;
        return this;
      },
    } as unknown as Response & { statusCode: number; body: unknown },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("errorHandler → Sentry.captureException", () => {
  it("капсулує неочікувану помилку (500) у Sentry.captureException", () => {
    const { req, res } = makeReqRes();
    const err = new Error("boom");
    errorHandler(err, req, res, () => {});
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual(
      expect.objectContaining({ code: "INTERNAL", requestId: "req_1" }),
    );
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledWith(err);
  });

  it("operational AppError (4xx) НЕ йде в Sentry.captureException", () => {
    const { req, res } = makeReqRes();
    const err = new AppError("bad input", { status: 400, code: "BAD_INPUT" });
    errorHandler(err, req, res, () => {});
    expect(res.statusCode).toBe(400);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("429 rate-limit теж НЕ йде у Sentry (це operational)", () => {
    const { req, res } = makeReqRes();
    const err = new AppError("rate limited", {
      status: 429,
      code: "RATE_LIMIT",
    });
    errorHandler(err, req, res, () => {});
    expect(res.statusCode).toBe(429);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});
