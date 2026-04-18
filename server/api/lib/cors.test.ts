import { describe, it, expect, afterEach } from "vitest";
import { getAllowedOrigins, setCorsHeaders } from "./cors.js";

describe("getAllowedOrigins", () => {
  const prevAllowed = process.env.ALLOWED_ORIGINS;
  const prevCors = process.env.CORS_ORIGINS;

  afterEach(() => {
    if (prevAllowed === undefined) delete process.env.ALLOWED_ORIGINS;
    else process.env.ALLOWED_ORIGINS = prevAllowed;
    if (prevCors === undefined) delete process.env.CORS_ORIGINS;
    else process.env.CORS_ORIGINS = prevCors;
  });

  it("parses comma-separated ALLOWED_ORIGINS", () => {
    process.env.ALLOWED_ORIGINS = " https://a.test , https://b.test ";
    const origins = getAllowedOrigins();
    expect(origins).toContain("https://a.test");
    expect(origins).toContain("https://b.test");
  });

  it("parses comma-separated CORS_ORIGINS", () => {
    process.env.CORS_ORIGINS =
      "https://sergeant.2dmanager.com.ua,https://sergeant.vercel.app";
    const origins = getAllowedOrigins();
    expect(origins).toContain("https://sergeant.2dmanager.com.ua");
    expect(origins).toContain("https://sergeant.vercel.app");
  });

  it("falls back to dev origins when unset", () => {
    delete process.env.ALLOWED_ORIGINS;
    delete process.env.CORS_ORIGINS;
    const origins = getAllowedOrigins();
    expect(origins).toContain("http://localhost:5173");
  });
});

describe("setCorsHeaders", () => {
  it("sets ACAO when origin is allowed", () => {
    const headers: Record<string, string> = {};
    const res = {
      setHeader(name: string, value: string) {
        headers[name] = value;
      },
    };
    const req = { headers: { origin: "http://localhost:5173" } };
    // @ts-expect-error — minimal mock, not a full ServerResponse
    setCorsHeaders(res, req);
    expect(headers["Access-Control-Allow-Origin"]).toBe(
      "http://localhost:5173",
    );
  });

  it("does not set ACAO when origin is unknown", () => {
    const headers: Record<string, string> = {};
    const res = {
      setHeader(name: string, value: string) {
        headers[name] = value;
      },
    };
    const req = { headers: { origin: "https://evil.example" } };
    // @ts-expect-error — minimal mock, not a full ServerResponse
    setCorsHeaders(res, req);
    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });
});
