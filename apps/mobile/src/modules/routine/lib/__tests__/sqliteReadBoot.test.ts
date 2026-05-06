const mockGetSqliteMigrationClient = jest.fn();
const mockMigrateRoutine = jest.fn();
const mockSetSqliteReadEnabled = jest.fn();
const mockRefreshSqliteCompletions = jest.fn();
const mockUseFlagValue = jest.fn();
const mockMigrationClient = { __label: "migration-client" };

jest.mock("@/core/db/sqlite", () => ({
  getSqliteMigrationClient: (...args: unknown[]) =>
    mockGetSqliteMigrationClient(...args),
}));

jest.mock("../clientMigrate", () => ({
  migrateRoutine: (...args: unknown[]) => mockMigrateRoutine(...args),
}));

jest.mock("../routineStore", () => ({
  setSqliteReadEnabled: (enabled: boolean) => mockSetSqliteReadEnabled(enabled),
}));

jest.mock("../sqliteReader", () => ({
  refreshSqliteCompletions: (...args: unknown[]) =>
    mockRefreshSqliteCompletions(...args),
}));

jest.mock("@/core/lib/featureFlags", () => ({
  getFlag: (id: string) => mockUseFlagValue(id),
}));

import {
  __resetSqliteReadBootForTests,
  bootSqliteReadPath,
} from "../sqliteReadBoot";

beforeEach(() => {
  mockGetSqliteMigrationClient.mockReset();
  mockMigrateRoutine.mockReset();
  mockSetSqliteReadEnabled.mockReset();
  mockRefreshSqliteCompletions.mockReset();
  mockUseFlagValue.mockReset();
  __resetSqliteReadBootForTests();
});

describe("bootSqliteReadPath (mobile)", () => {
  it("activates the SQLite read path when the flag and user id are present", async () => {
    mockUseFlagValue.mockReturnValue(true);
    mockGetSqliteMigrationClient.mockResolvedValue(mockMigrationClient);

    await expect(bootSqliteReadPath("user-1")).resolves.toBe(true);

    expect(mockUseFlagValue).toHaveBeenCalledWith(
      "feature.routine.sqlite_v2.read_sqlite",
    );
    expect(mockGetSqliteMigrationClient).toHaveBeenCalledTimes(1);
    expect(mockMigrateRoutine).toHaveBeenCalledWith(mockMigrationClient);
    expect(mockRefreshSqliteCompletions).toHaveBeenCalledWith(
      mockMigrationClient,
      "user-1",
    );
    expect(mockSetSqliteReadEnabled).toHaveBeenLastCalledWith(true);
  });

  it("keeps MMKV reads when the persisted override disables the flag", async () => {
    mockUseFlagValue.mockReturnValue(false);

    await expect(bootSqliteReadPath("user-1")).resolves.toBe(false);

    expect(mockSetSqliteReadEnabled).toHaveBeenCalledWith(false);
    expect(mockGetSqliteMigrationClient).not.toHaveBeenCalled();
  });

  it("falls back to MMKV reads when SQLite boot fails", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    mockUseFlagValue.mockReturnValue(true);
    mockGetSqliteMigrationClient.mockRejectedValue(new Error("sqlite down"));

    await expect(bootSqliteReadPath("user-1")).resolves.toBe(false);

    expect(mockSetSqliteReadEnabled).toHaveBeenCalledWith(false);
    warnSpy.mockRestore();
  });
});
