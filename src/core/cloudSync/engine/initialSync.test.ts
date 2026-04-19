// @vitest-environment jsdom
/**
 * Regression tests for the `initialSync` engine entry point's boolean
 * return value.
 *
 * Motivation: the React hook orchestrator marks `didInitialSync.current =
 * true` BEFORE awaiting the promise, so a transient network failure on
 * the very first sign-in would otherwise be treated as "done" and never
 * retried until the page reloaded. `initialSync` now signals success /
 * failure through its resolved value so the hook can release the slot on
 * failure.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@shared/api", async () => {
  const actual =
    await vi.importActual<typeof import("@shared/api")>("@shared/api");
  return {
    ...actual,
    syncApi: {
      pullAll: vi.fn(),
      pushAll: vi.fn(),
      push: vi.fn(),
      pull: vi.fn(),
    },
  };
});

import { syncApi } from "@shared/api";
import { STORAGE_KEYS } from "@shared/lib/storageKeys";
import { markMigrationDone } from "../state/migration";
import { initialSync } from "./initialSync";

const mockedPullAll = syncApi.pullAll as unknown as ReturnType<typeof vi.fn>;
const mockedPushAll = syncApi.pushAll as unknown as ReturnType<typeof vi.fn>;

function makeArgs() {
  const onStart = vi.fn();
  const onSuccess = vi.fn();
  const onError = vi.fn();
  const onNeedMigration = vi.fn();
  const onSettled = vi.fn();
  return {
    args: {
      user: { id: "u1", email: "u@x" },
      onStart,
      onSuccess,
      onError,
      onNeedMigration,
      onSettled,
    },
    onStart,
    onSuccess,
    onError,
    onNeedMigration,
    onSettled,
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});
afterEach(() => {
  localStorage.clear();
});

describe("initialSync return value", () => {
  it("returns true on a clean noop (no cloud, no local, already migrated)", async () => {
    mockedPullAll.mockResolvedValueOnce({ modules: {} });
    const { args, onSuccess, onError, onSettled } = makeArgs();
    // Pre-mark migration so the branch becomes `noop` instead of
    // `needMigration`.
    markMigrationDone("u1");

    const result = await initialSync(args);

    expect(result).toBe(true);
    expect(onError).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("returns false when syncApi.pullAll throws", async () => {
    mockedPullAll.mockRejectedValueOnce(new Error("network down"));
    const { args, onSuccess, onError, onSettled } = makeArgs();

    const result = await initialSync(args);

    expect(result).toBe(false);
    expect(onError).toHaveBeenCalledWith("network down");
    expect(onSuccess).not.toHaveBeenCalled();
    // Even on failure the settled callback still fires — the hook relies
    // on that to release the syncing React state.
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("returns true on the needMigration branch (decision reached, not a failure)", async () => {
    // No cloud, has local data, not migrated → needMigration.
    mockedPullAll.mockResolvedValueOnce({ modules: {} });
    localStorage.setItem(
      STORAGE_KEYS.FINYK_BUDGETS,
      JSON.stringify({ any: "data" }),
    );
    const { args, onNeedMigration, onError, onSettled } = makeArgs();

    const result = await initialSync(args);

    expect(result).toBe(true);
    expect(onNeedMigration).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("returns false when a merge push fails mid-reconciliation", async () => {
    // Arrange: cloud has some data, local has some dirty data → merge
    // branch. pushAll inside initialSync throws.
    mockedPullAll.mockResolvedValueOnce({
      modules: {
        finyk: {
          data: { a: 1 },
          clientUpdatedAt: new Date().toISOString(),
          version: 1,
        },
      },
    });
    mockedPushAll.mockRejectedValueOnce(new Error("push 5xx"));
    // Local dirty state so merge actually pushes something.
    localStorage.setItem(STORAGE_KEYS.FINYK_BUDGETS, JSON.stringify({ x: 1 }));
    localStorage.setItem(
      STORAGE_KEYS.SYNC_DIRTY_MODULES,
      JSON.stringify({ finyk: true }),
    );
    markMigrationDone("u1");
    const { args, onError, onSuccess, onSettled } = makeArgs();

    const result = await initialSync(args);

    expect(result).toBe(false);
    expect(onError).toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalledTimes(1);
  });
});
