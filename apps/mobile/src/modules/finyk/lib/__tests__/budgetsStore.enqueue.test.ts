/**
 * Cloud-sync wiring tests for `useFinykBudgetsStore`.
 *
 * Mirrors the assets/transactions parity tests: every mutator must
 * persist to MMKV and call `enqueueChange` with the matching key so
 * the cloud-sync scheduler picks the change up.
 */
import { act, renderHook } from "@testing-library/react-native";

import { STORAGE_KEYS } from "@sergeant/shared";

import { _getMMKVInstance } from "@/lib/storage";

const mockEnqueueChange = jest.fn();

jest.mock("@/sync/enqueue", () => ({
  enqueueChange: (...args: unknown[]) => mockEnqueueChange(...args),
}));

import { useFinykBudgetsStore } from "../budgetsStore";

const KEY_BUDGETS = STORAGE_KEYS.FINYK_BUDGETS;
const KEY_PLAN = STORAGE_KEYS.FINYK_MONTHLY_PLAN;
const KEY_SUBS = STORAGE_KEYS.FINYK_SUBS;

beforeEach(() => {
  _getMMKVInstance().clearAll();
  mockEnqueueChange.mockClear();
});

describe("useFinykBudgetsStore — enqueueChange wiring", () => {
  it("setBudgets fires enqueueChange with the budgets key", () => {
    const { result } = renderHook(() => useFinykBudgetsStore());

    act(() => {
      result.current.setBudgets([
        { id: "b1", type: "limit", limit: 1000, categoryId: "food" } as never,
      ]);
    });

    expect(mockEnqueueChange).toHaveBeenCalledWith(KEY_BUDGETS);
    expect(mockEnqueueChange).toHaveBeenCalledTimes(1);
  });

  it("setMonthlyPlan fires enqueueChange with the monthly plan key", () => {
    const { result } = renderHook(() => useFinykBudgetsStore());

    act(() => {
      result.current.setMonthlyPlan({
        income: 30000,
        expense: 20000,
        savings: 5000,
      });
    });

    expect(mockEnqueueChange).toHaveBeenCalledWith(KEY_PLAN);
    expect(mockEnqueueChange).toHaveBeenCalledTimes(1);
  });

  it("setSubscriptions fires enqueueChange with the subs key", () => {
    const { result } = renderHook(() => useFinykBudgetsStore());

    act(() => {
      result.current.setSubscriptions([
        { id: "s1", name: "Netflix", amount: 250, day: 5 } as never,
      ]);
    });

    expect(mockEnqueueChange).toHaveBeenCalledWith(KEY_SUBS);
    expect(mockEnqueueChange).toHaveBeenCalledTimes(1);
  });

  it("each setter fires exactly one enqueueChange call", () => {
    const { result } = renderHook(() => useFinykBudgetsStore());

    act(() => {
      result.current.setBudgets([]);
    });
    act(() => {
      result.current.setMonthlyPlan({ income: 0, expense: 0, savings: 0 });
    });
    act(() => {
      result.current.setSubscriptions([]);
    });

    expect(mockEnqueueChange).toHaveBeenCalledTimes(3);
    expect(mockEnqueueChange).toHaveBeenNthCalledWith(1, KEY_BUDGETS);
    expect(mockEnqueueChange).toHaveBeenNthCalledWith(2, KEY_PLAN);
    expect(mockEnqueueChange).toHaveBeenNthCalledWith(3, KEY_SUBS);
  });
});
