import { describe, it, expect } from "vitest";
import { buildApiCspDirectives, apiHelmetMiddleware } from "./security.js";

describe("buildApiCspDirectives", () => {
  const d = buildApiCspDirectives();

  it("default-src заблоковано", () => {
    expect(d.defaultSrc).toEqual(["'none'"]);
  });

  it("frame-ancestors блокує clickjacking", () => {
    expect(d.frameAncestors).toEqual(["'none'"]);
  });

  it("base-uri заборонено", () => {
    expect(d.baseUri).toEqual(["'none'"]);
  });

  it("form-action заборонено", () => {
    expect(d.formAction).toEqual(["'none'"]);
  });

  it("script-src і style-src повністю заблоковано (API не віддає HTML)", () => {
    expect(d.scriptSrc).toEqual(["'none'"]);
    expect(d.styleSrc).toEqual(["'none'"]);
  });

  it("connect-src 'self' — дозволяє preflight з того самого origin", () => {
    expect(d.connectSrc).toEqual(["'self'"]);
  });

  it("img-src дозволяє data: (favicon, inline error pages)", () => {
    expect(d.imgSrc).toContain("'self'");
    expect(d.imgSrc).toContain("data:");
  });
});

describe("apiHelmetMiddleware", () => {
  function captureCsp(middleware) {
    let csp;
    const res = {
      setHeader(name, value) {
        if (/content-security-policy/i.test(name)) csp = { name, value };
      },
      getHeader() {},
      removeHeader() {},
    };
    middleware({ method: "GET", headers: {} }, res, () => {});
    return csp;
  }

  it("API-only (default) → виставляє строгу CSP", () => {
    const csp = captureCsp(apiHelmetMiddleware());
    expect(csp).toBeTruthy();
    expect(csp.name).toBe("Content-Security-Policy");
    expect(String(csp.value)).toContain("default-src 'none'");
    expect(String(csp.value)).toContain("script-src 'none'");
  });

  it("servesFrontend=true → CSP вимкнена (не ламає SPA на Replit)", () => {
    const csp = captureCsp(apiHelmetMiddleware({ servesFrontend: true }));
    expect(csp).toBeUndefined();
  });
});
