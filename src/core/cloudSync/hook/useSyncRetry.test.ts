/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  replayOfflineQueueMock: vi.fn(() => Promise.resolve()),
  getDirtyModulesMock: vi.fn<() => Record<string, unknown>>(() => ({})),
}));
const { replayOfflineQueueMock, getDirtyModulesMock } = mocks;

vi.mock("../engine/replay", () => ({
  replayOfflineQueue: mocks.replayOfflineQueueMock,
}));
vi.mock("../state/dirtyModules", () => ({
  getDirtyModules: mocks.getDirtyModulesMock,
}));
vi.mock("../logger", () => ({
  syncLog: { scheduleSync: vi.fn() },
}));

import { useSyncRetry } from "./useSyncRetry";
import { SYNC_EVENT } from "../config";

describe("useSyncRetry — scheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    replayOfflineQueueMock.mockReset();
    replayOfflineQueueMock.mockImplementation(() => Promise.resolve());
    getDirtyModulesMock.mockReset();
    getDirtyModulesMock.mockReturnValue({});
  });
  afterEach(() => {
    // vitest.config.js не вмикає `globals: true`, тому
    // @testing-library/react не реєструє afterEach cleanup автоматично —
    // без ручного виклику renderHook-листенери з попередніх тестів
    // залишаються на window і ламають cross-test очікування.
    cleanup();
    vi.useRealTimers();
  });

  it("online event → replayOfflineQueue, далі runSync", async () => {
    const runSync = vi.fn();
    renderHook(() => useSyncRetry(true, runSync));

    window.dispatchEvent(new Event("online"));
    // replayOfflineQueue — async Promise.resolve(). Пропускаємо мікротаски
    // через `advanceTimersByTimeAsync(0)` — це прокачує микротаски і НЕ
    // чіпає periodic interval (2хв), щоб не зірватись в infinite-loop guard.
    await vi.advanceTimersByTimeAsync(0);

    expect(replayOfflineQueueMock).toHaveBeenCalledTimes(1);
    expect(runSync).toHaveBeenCalledTimes(1);
  });

  it("серія SYNC_EVENT за 100 мс коалесить в один виклик runSync (5s debounce)", () => {
    const runSync = vi.fn();
    renderHook(() => useSyncRetry(true, runSync));

    for (let i = 0; i < 5; i++) {
      window.dispatchEvent(new Event(SYNC_EVENT));
      vi.advanceTimersByTime(100);
    }
    // Поки debounce не дотік — runSync не викликався
    expect(runSync).not.toHaveBeenCalled();

    vi.advanceTimersByTime(5_000);
    expect(runSync).toHaveBeenCalledTimes(1);
  });

  it("periodic (2 хв) нічого не робить якщо немає dirty модулів", () => {
    const runSync = vi.fn();
    renderHook(() => useSyncRetry(true, runSync));

    getDirtyModulesMock.mockReturnValue({});
    vi.advanceTimersByTime(2 * 60 * 1000);
    expect(runSync).not.toHaveBeenCalled();
  });

  it("periodic (2 хв) викликає runSync якщо є dirty модулі", () => {
    const runSync = vi.fn();
    renderHook(() => useSyncRetry(true, runSync));

    getDirtyModulesMock.mockReturnValue({ finyk: true });
    vi.advanceTimersByTime(2 * 60 * 1000);
    expect(runSync).toHaveBeenCalledTimes(1);
  });

  it("enabled=false: нічого не підписується", () => {
    const runSync = vi.fn();
    renderHook(() => useSyncRetry(false, runSync));

    window.dispatchEvent(new Event("online"));
    window.dispatchEvent(new Event(SYNC_EVENT));
    vi.advanceTimersByTime(10 * 60 * 1000);

    expect(runSync).not.toHaveBeenCalled();
    expect(replayOfflineQueueMock).not.toHaveBeenCalled();
  });

  it("unmount скасовує pending debounce (runSync після demount не спрацює)", () => {
    const runSync = vi.fn();
    const { unmount } = renderHook(() => useSyncRetry(true, runSync));

    window.dispatchEvent(new Event(SYNC_EVENT));
    vi.advanceTimersByTime(1_000);
    unmount();
    vi.advanceTimersByTime(10_000);

    expect(runSync).not.toHaveBeenCalled();
  });

  it("unmount скасовує periodic interval", () => {
    const runSync = vi.fn();
    getDirtyModulesMock.mockReturnValue({ finyk: true });
    const { unmount } = renderHook(() => useSyncRetry(true, runSync));

    vi.advanceTimersByTime(2 * 60 * 1000);
    expect(runSync).toHaveBeenCalledTimes(1);

    unmount();
    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(runSync).toHaveBeenCalledTimes(1);
  });

  it("online listener не залишається після unmount", () => {
    const runSync = vi.fn();
    const { unmount } = renderHook(() => useSyncRetry(true, runSync));
    unmount();

    window.dispatchEvent(new Event("online"));
    vi.advanceTimersByTime(1_000);
    expect(replayOfflineQueueMock).not.toHaveBeenCalled();
  });
});
