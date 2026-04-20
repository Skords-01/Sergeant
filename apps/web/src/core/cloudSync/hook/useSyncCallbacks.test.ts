/**
 * Regression tests for the in-flight guard that protects cloud-sync entry
 * points from concurrent execution.
 *
 * The key invariant — validated here — is that the guard is ALWAYS released
 * once the wrapped function settles, including when the function resolves
 * without going through its own try/finally (the stuck-busy failure mode).
 * This was a real latent bug: `pushDirty` early-returns when there are no
 * dirty modules, and the historical guard relied on the engine's
 * `onSettled` (called from inside the try/finally) to release the lock. A
 * call triggered by the `online` event on a clean client would therefore
 * leave the guard permanently acquired, blocking every subsequent sync for
 * the rest of the session.
 */
import { describe, it, expect } from "vitest";
import { createInFlightGuard, runExclusiveWith } from "./useSyncCallbacks";

describe("createInFlightGuard", () => {
  it("starts free", () => {
    const g = createInFlightGuard();
    expect(g.isBusy()).toBe(false);
  });

  it("tryAcquire returns true once, then false until release", () => {
    const g = createInFlightGuard();
    expect(g.tryAcquire()).toBe(true);
    expect(g.tryAcquire()).toBe(false);
    expect(g.tryAcquire()).toBe(false);
    g.release();
    expect(g.tryAcquire()).toBe(true);
  });

  it("release is idempotent", () => {
    const g = createInFlightGuard();
    g.tryAcquire();
    g.release();
    g.release();
    expect(g.isBusy()).toBe(false);
    expect(g.tryAcquire()).toBe(true);
  });

  it("forceClaim sets busy even if already busy (barge-in)", () => {
    const g = createInFlightGuard();
    g.forceClaim();
    expect(g.isBusy()).toBe(true);
    // forceClaim on an already-busy guard remains busy (no-op-like)
    g.forceClaim();
    expect(g.isBusy()).toBe(true);
  });

  it("forceClaim blocks a subsequent tryAcquire until released", () => {
    const g = createInFlightGuard();
    g.forceClaim();
    expect(g.tryAcquire()).toBe(false);
    g.release();
    expect(g.tryAcquire()).toBe(true);
  });
});

describe("runExclusiveWith", () => {
  it("releases the guard when fn resolves normally", async () => {
    const g = createInFlightGuard();
    const result = await runExclusiveWith(
      g,
      async () => "ok" as const,
      "fallback",
    );
    expect(result).toBe("ok");
    expect(g.isBusy()).toBe(false);
  });

  it("releases the guard when fn rejects", async () => {
    const g = createInFlightGuard();
    await expect(
      runExclusiveWith(
        g,
        async () => {
          throw new Error("boom");
        },
        "fallback",
      ),
    ).rejects.toThrow("boom");
    expect(g.isBusy()).toBe(false);
  });

  it("returns fallback synchronously when guard is already busy", async () => {
    const g = createInFlightGuard();
    g.forceClaim();
    const res = await runExclusiveWith(
      g,
      async () => "ran" as const,
      "fallback" as const,
    );
    expect(res).toBe("fallback");
    // Guard still busy — runExclusiveWith must NOT release a lock it didn't
    // acquire.
    expect(g.isBusy()).toBe(true);
  });

  it("releases the guard when fn resolves WITHOUT invoking any engine callback (early-return path)", async () => {
    // This is the exact shape of the pushDirty early-return bug: the engine
    // path returns before its own try/finally, so no `onSettled` fires.
    // The guard must still be released so subsequent calls can proceed.
    const g = createInFlightGuard();
    let ranTwice = false;
    await runExclusiveWith(
      g,
      async () => {
        // simulate `if (dirtyMods.length === 0) return;` — no callbacks fire.
      },
      undefined,
    );
    expect(g.isBusy()).toBe(false);
    // Prove recovery: a subsequent runExclusiveWith actually runs.
    await runExclusiveWith(
      g,
      async () => {
        ranTwice = true;
      },
      undefined,
    );
    expect(ranTwice).toBe(true);
  });

  it("serializes: a second call while the first is in flight gets fallback", async () => {
    const g = createInFlightGuard();
    let resolveFirst: () => void = () => {};
    const firstPromise = runExclusiveWith(
      g,
      () =>
        new Promise<string>((r) => {
          resolveFirst = () => r("first");
        }),
      "fallback",
    );
    // Second call happens while first is mid-flight.
    const secondResult = await runExclusiveWith(
      g,
      async () => "second",
      "fallback" as const,
    );
    expect(secondResult).toBe("fallback");
    resolveFirst();
    expect(await firstPromise).toBe("first");
    expect(g.isBusy()).toBe(false);
  });
});
