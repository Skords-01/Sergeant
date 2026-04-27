/**
 * Cloud-sync wiring tests for `useDailyLog`.
 *
 * Verifies that `addEntry` and `deleteEntry` route through
 * `enqueueChange` with `FIZRUK_DAILY_LOG`.
 */
import { act, renderHook } from "@testing-library/react-native";

import { STORAGE_KEYS } from "@sergeant/shared";

import { _getMMKVInstance } from "@/lib/storage";

const mockEnqueueChange = jest.fn();

jest.mock("@/sync/enqueue", () => ({
  enqueueChange: (...args: unknown[]) => mockEnqueueChange(...args),
}));

import { useDailyLog } from "../useDailyLog";

const STORAGE_KEY = STORAGE_KEYS.FIZRUK_DAILY_LOG;

beforeEach(() => {
  _getMMKVInstance().clearAll();
  mockEnqueueChange.mockClear();
});

describe("useDailyLog — enqueueChange wiring", () => {
  it("addEntry fires enqueueChange with FIZRUK_DAILY_LOG", () => {
    const { result } = renderHook(() => useDailyLog());
    act(() => {
      result.current.addEntry({ sleepHours: 7, energyLevel: 4 });
    });
    expect(mockEnqueueChange).toHaveBeenCalledWith(STORAGE_KEY);
    expect(mockEnqueueChange).toHaveBeenCalledTimes(1);
  });

  it("deleteEntry fires enqueueChange when entry exists", () => {
    const { result } = renderHook(() => useDailyLog());
    let id = "";
    act(() => {
      id = result.current.addEntry({ sleepHours: 8 }).id;
    });
    mockEnqueueChange.mockClear();

    act(() => {
      result.current.deleteEntry(id);
    });
    expect(mockEnqueueChange).toHaveBeenCalledWith(STORAGE_KEY);
    expect(mockEnqueueChange).toHaveBeenCalledTimes(1);
  });

  it("deleteEntry is silent for unknown id", () => {
    const { result } = renderHook(() => useDailyLog());
    act(() => {
      result.current.deleteEntry("nonexistent");
    });
    expect(mockEnqueueChange).not.toHaveBeenCalled();
  });
});
