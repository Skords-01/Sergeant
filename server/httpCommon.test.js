import { describe, it, expect } from "vitest";
import { buildApiCspDirectives } from "./httpCommon.mjs";

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
