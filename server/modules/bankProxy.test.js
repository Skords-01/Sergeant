import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import monoHandler from "./mono.js";
import privatHandler from "./privat.js";

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: undefined,
  };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    res.body = payload;
    return res;
  };
  res.setHeader = (name, value) => {
    res.headers[name] = value;
  };
  res.end = () => res;
  return res;
}

describe("mono proxy path validation", () => {
  const origFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = origFetch;
    vi.restoreAllMocks();
  });

  it("rejects path with CRLF or special characters", async () => {
    const req = {
      method: "GET",
      headers: { "x-token": "tok", origin: "http://localhost:5173" },
      query: { path: "/personal/client-info\r\nX-Evil: yes" },
    };
    const res = mockRes();
    await monoHandler(req, res);
    expect(res.statusCode).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects path with '..'", async () => {
    const req = {
      method: "GET",
      headers: { "x-token": "tok", origin: "http://localhost:5173" },
      query: { path: "/personal/../admin" },
    };
    const res = mockRes();
    await monoHandler(req, res);
    expect(res.statusCode).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects prefix-bypass like /personal/client-info-extra", async () => {
    const req = {
      method: "GET",
      headers: { "x-token": "tok", origin: "http://localhost:5173" },
      query: { path: "/personal/client-info-extra" },
    };
    const res = mockRes();
    await monoHandler(req, res);
    expect(res.statusCode).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("allows exact /personal/client-info", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    const req = {
      method: "GET",
      headers: { "x-token": "tok", origin: "http://localhost:5173" },
      query: { path: "/personal/client-info" },
    };
    const res = mockRes();
    await monoHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(global.fetch).toHaveBeenCalledOnce();
  });

  it("allows /personal/statement/<id>", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    const req = {
      method: "GET",
      headers: { "x-token": "tok", origin: "http://localhost:5173" },
      query: { path: "/personal/statement/abc123" },
    };
    const res = mockRes();
    await monoHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(global.fetch).toHaveBeenCalledOnce();
  });
});

describe("privat proxy path validation", () => {
  const origFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = origFetch;
    vi.restoreAllMocks();
  });

  it("rejects prefix-bypass like /statements/balance/final-evil", async () => {
    const req = {
      method: "GET",
      headers: {
        "x-privat-id": "id",
        "x-privat-token": "tok",
        origin: "http://localhost:5173",
      },
      query: { path: "/statements/balance/final-evil" },
    };
    const res = mockRes();
    await privatHandler(req, res);
    expect(res.statusCode).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects CRLF in merchant headers", async () => {
    const req = {
      method: "GET",
      headers: {
        "x-privat-id": "id\r\nX-Evil: yes",
        "x-privat-token": "tok",
        origin: "http://localhost:5173",
      },
      query: { path: "/statements/balance/final" },
    };
    const res = mockRes();
    await privatHandler(req, res);
    expect(res.statusCode).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("allows /statements/transactions/<acc>", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    const req = {
      method: "GET",
      headers: {
        "x-privat-id": "id",
        "x-privat-token": "tok",
        origin: "http://localhost:5173",
      },
      query: { path: "/statements/transactions/UA11" },
    };
    const res = mockRes();
    await privatHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(global.fetch).toHaveBeenCalledOnce();
  });
});
