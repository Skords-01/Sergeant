// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { resolveInitialSync } from "../conflict/resolver";

const noopGetLocal = () => 0;

describe("resolveInitialSync", () => {
  it("adopts cloud when there's no local data", () => {
    const plan = resolveInitialSync({
      cloud: {
        finyk: { data: { a: 1 }, version: 7 },
      },
      hasAnyLocalData: false,
      migrated: false,
      userId: "u1",
      modifiedTimes: {},
      getLocalVersion: noopGetLocal,
      dirtyModules: {},
    });
    expect(plan.kind).toBe("adoptCloud");
    if (plan.kind === "adoptCloud") {
      expect(plan.applyModules).toEqual([
        { mod: "finyk", data: { a: 1 }, version: 7 },
      ]);
    }
  });

  it("requests migration when there's local data but empty cloud and not migrated", () => {
    const plan = resolveInitialSync({
      cloud: {},
      hasAnyLocalData: true,
      migrated: false,
      userId: "u1",
      modifiedTimes: {},
      getLocalVersion: noopGetLocal,
      dirtyModules: {},
    });
    expect(plan.kind).toBe("needMigration");
  });

  it("merges when both sides have data — cloud wins on higher version", () => {
    const plan = resolveInitialSync({
      cloud: {
        finyk: { data: { a: 2 }, version: 10 },
      },
      hasAnyLocalData: true,
      migrated: true,
      userId: "u1",
      modifiedTimes: { finyk: "2024-01-01T00:00:00.000Z" },
      getLocalVersion: (_u, mod) => (mod === "finyk" ? 5 : 0),
      dirtyModules: {},
    });
    expect(plan.kind).toBe("merge");
    if (plan.kind === "merge") {
      expect(plan.applyModules).toEqual([{ mod: "finyk", data: { a: 2 } }]);
      expect(plan.setVersions).toEqual([{ mod: "finyk", version: 10 }]);
      expect(plan.dirtyMods).toEqual([]);
    }
  });

  it("merges when both sides have data — cloud wins on newer serverUpdatedAt", () => {
    const plan = resolveInitialSync({
      cloud: {
        fizruk: {
          data: { w: 1 },
          version: 5,
          serverUpdatedAt: "2024-06-01T00:00:00.000Z",
        },
      },
      hasAnyLocalData: true,
      migrated: true,
      userId: "u1",
      modifiedTimes: { fizruk: "2024-01-01T00:00:00.000Z" },
      getLocalVersion: () => 5,
      dirtyModules: {},
    });
    expect(plan.kind).toBe("merge");
    if (plan.kind === "merge") {
      expect(plan.applyModules).toEqual([{ mod: "fizruk", data: { w: 1 } }]);
    }
  });

  it("merges but does not apply when local is newer than cloud", () => {
    const plan = resolveInitialSync({
      cloud: {
        fizruk: {
          data: { w: 1 },
          version: 5,
          serverUpdatedAt: "2024-01-01T00:00:00.000Z",
        },
      },
      hasAnyLocalData: true,
      migrated: true,
      userId: "u1",
      modifiedTimes: { fizruk: "2024-06-01T00:00:00.000Z" },
      getLocalVersion: () => 5,
      dirtyModules: {},
    });
    expect(plan.kind).toBe("merge");
    if (plan.kind === "merge") {
      expect(plan.applyModules).toEqual([]);
      expect(plan.setVersions).toEqual([{ mod: "fizruk", version: 5 }]);
    }
  });

  it("surfaces dirty modules in the merge plan", () => {
    const plan = resolveInitialSync({
      cloud: {
        finyk: { data: { a: 1 }, version: 1 },
      },
      hasAnyLocalData: true,
      migrated: true,
      userId: "u1",
      modifiedTimes: {},
      getLocalVersion: () => 0,
      dirtyModules: { routine: true, nutrition: true },
    });
    expect(plan.kind).toBe("merge");
    if (plan.kind === "merge") {
      expect(plan.dirtyMods.sort()).toEqual(["nutrition", "routine"]);
    }
  });

  it("returns noop when neither side has data", () => {
    const plan = resolveInitialSync({
      cloud: undefined,
      hasAnyLocalData: false,
      migrated: true,
      userId: "u1",
      modifiedTimes: {},
      getLocalVersion: noopGetLocal,
      dirtyModules: {},
    });
    expect(plan.kind).toBe("noop");
  });

  it("treats cloud with only empty-data entries as no cloud data", () => {
    const plan = resolveInitialSync({
      cloud: { finyk: { data: {} } },
      hasAnyLocalData: true,
      migrated: false,
      userId: "u1",
      modifiedTimes: {},
      getLocalVersion: noopGetLocal,
      dirtyModules: {},
    });
    expect(plan.kind).toBe("needMigration");
  });
});
