import { describe, it, expect, afterEach } from "vitest";
import { getAllowedOrigins, setCorsHeaders } from "./cors.js";

describe("getAllowedOrigins", () => {
  const prev = process.env.ALLOWED_ORIGINS;

  afterEach(() => {
    if (prev === undefined) delete process.env.ALLOWED_ORIGINS;
    else process.env.ALLOWED_ORIGINS = prev;
  });

  it("parses comma-separated ALLOWED_ORIGINS", () => {
    process.env.ALLOWED_ORIGINS = " https://a.test , https://b.test ";
    expect(getAllowedOrigins()).toEqual(["https://a.test", "https://b.test"]);
  });

  it("falls back to defaults when unset", () => {
    delete process.env.ALLOWED_ORIGINS;
    const origins = getAllowedOrigins();
    expect(origins).toContain("http://localhost:5173");
  });
});

describe("setCorsHeaders", () => {
  it("sets ACAO when origin is allowed", () => {
    const headers = {};
    const res = {
      setHeader(name, value) {
        headers[name] = value;
      },
    };
    const req = { headers: { origin: "http://localhost:5173" } };
    setCorsHeaders(res, req);
    expect(headers["Access-Control-Allow-Origin"]).toBe(
      "http://localhost:5173",
    );
  });

  it("does not set ACAO when origin is unknown", () => {
    const headers = {};
    const res = {
      setHeader(name, value) {
        headers[name] = value;
      },
    };
    const req = { headers: { origin: "https://evil.example" } };
    setCorsHeaders(res, req);
    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });
});
