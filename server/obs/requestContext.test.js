import { describe, it, expect } from "vitest";
import {
  als,
  getRequestContext,
  setUserId,
  setRequestModule,
  withRequestContext,
} from "./requestContext.js";

describe("withRequestContext", () => {
  it("встановлює store з requestId із req і дозволяє оновити userId/module", () => {
    const req = { requestId: "req-1" };
    let captured;

    withRequestContext(req, {}, () => {
      setUserId("u-42");
      setRequestModule("nutrition");
      captured = { ...als.getStore() };
    });

    expect(captured).toEqual({
      requestId: "req-1",
      userId: "u-42",
      module: "nutrition",
    });
  });

  it("поза ALS-контекстом getRequestContext повертає null", () => {
    expect(getRequestContext()).toBeNull();
  });

  it("два паралельні контексти не змішуються", async () => {
    const run = (id) =>
      new Promise((resolve) =>
        withRequestContext({ requestId: id }, {}, async () => {
          await new Promise((r) => setTimeout(r, 1));
          resolve(als.getStore().requestId);
        }),
      );
    const [a, b] = await Promise.all([run("a"), run("b")]);
    expect(a).toBe("a");
    expect(b).toBe("b");
  });
});
