/**
 * Render tests for `<SyncStatusIndicator>` and `<SyncStatusOverlay>`.
 *
 * Suite 1 — SyncStatusIndicator (prop-driven)
 *   `useSyncStatus` is mocked so each state (`idle` / `syncing` /
 *   `offline` / `error`) can be asserted in isolation without standing
 *   up the whole CloudSync stack. `AccessibilityInfo` is stubbed to
 *   match `Skeleton.test.tsx` — we don't exercise the animated pulse,
 *   only its presence + accessibility affordances.
 *
 * Suite 2 — SyncStatusOverlay (CloudSyncContext wiring)
 *   Mounts the real `SyncStatusOverlay` inside a stub
 *   `CloudSyncContext.Provider`. Context value is mutated and rerenders
 *   drive the provider-update path so actual React context propagation
 *   is exercised, not just hook-return mocking. This catches regressions
 *   where the context value is dropped, prop names are renamed, or the
 *   overlay stops re-rendering when the provider's sync state changes.
 */
import { fireEvent, render } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";

import {
  CloudSyncContext,
  type UseCloudSyncReturn,
} from "@/sync/CloudSyncProvider";

import { SyncStatusOverlay } from "./SyncStatusOverlay";
import { SyncStatusIndicator } from "./SyncStatusIndicator";

jest.mock("@/sync/hook/useSyncStatus", () => ({
  useSyncStatus: jest.fn(),
}));

jest.mock("react-native-safe-area-context", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require("react-native");
  return {
    SafeAreaView: View,
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useSyncStatus } = require("@/sync/hook/useSyncStatus") as {
  useSyncStatus: jest.Mock;
};

function mockStatus(overrides: {
  dirtyCount?: number;
  queuedCount?: number;
  isOnline?: boolean;
}) {
  useSyncStatus.mockReturnValue({
    dirtyCount: overrides.dirtyCount ?? 0,
    queuedCount: overrides.queuedCount ?? 0,
    isOnline: overrides.isOnline ?? true,
  });
}

function stubAccessibility() {
  jest
    .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
    .mockResolvedValue(false);
  jest
    .spyOn(AccessibilityInfo, "addEventListener")
    .mockImplementation(() => ({ remove: () => {} }) as never);
}

// ---------------------------------------------------------------------------
// Suite 1 — SyncStatusIndicator (prop-driven)
// ---------------------------------------------------------------------------

describe("SyncStatusIndicator", () => {
  beforeEach(stubAccessibility);

  afterEach(() => {
    jest.restoreAllMocks();
    useSyncStatus.mockReset();
  });

  describe("idle state", () => {
    it("renders the compact 'Синк: on' pill when online and nothing pending", () => {
      mockStatus({});
      const { getByText } = render(<SyncStatusIndicator />);
      expect(getByText("Синк: on")).toBeTruthy();
    });

    it("collapses to null with variant=silent-when-idle", () => {
      mockStatus({});
      const { toJSON } = render(
        <SyncStatusIndicator variant="silent-when-idle" />,
      );
      expect(toJSON()).toBeNull();
    });

    it("still renders non-idle states regardless of variant=silent-when-idle", () => {
      mockStatus({ isOnline: false, queuedCount: 2 });
      const { getByText } = render(
        <SyncStatusIndicator variant="silent-when-idle" />,
      );
      expect(getByText(/Офлайн/)).toBeTruthy();
    });
  });

  describe("syncing state", () => {
    it("shows 'Синхронізація…' when queued or dirty work is pending", () => {
      mockStatus({ queuedCount: 3 });
      const { getByText } = render(<SyncStatusIndicator />);
      expect(getByText("Синхронізація…")).toBeTruthy();
    });

    it("shows the pending pluralization when queue is non-empty", () => {
      mockStatus({ queuedCount: 5 });
      const { getByText } = render(<SyncStatusIndicator />);
      expect(getByText("5 змін у черзі")).toBeTruthy();
    });

    it("prefers max(dirtyCount, queuedCount) as the pending count", () => {
      mockStatus({ dirtyCount: 7, queuedCount: 2 });
      const { getByText } = render(<SyncStatusIndicator />);
      expect(getByText("7 змін у черзі")).toBeTruthy();
    });
  });

  describe("offline state", () => {
    it("shows the offline pill with the pending count when there is a queue", () => {
      mockStatus({ isOnline: false, queuedCount: 2 });
      const { getByText } = render(<SyncStatusIndicator />);
      expect(getByText("Офлайн — 2 зміни у черзі")).toBeTruthy();
    });

    it("shows a bare offline pill when nothing is queued", () => {
      mockStatus({ isOnline: false });
      const { getByText } = render(<SyncStatusIndicator />);
      expect(getByText("Офлайн")).toBeTruthy();
    });
  });

  describe("error state", () => {
    it("switches to the error pill when the `error` prop is truthy", () => {
      mockStatus({});
      const { getByText } = render(
        <SyncStatusIndicator error="Server unreachable" />,
      );
      expect(getByText("Помилка синхронізації")).toBeTruthy();
    });

    it("renders the retry button when both `error` and `onRetry` are provided", () => {
      mockStatus({});
      const onRetry = jest.fn();
      const { getByText } = render(
        <SyncStatusIndicator error="Boom" onRetry={onRetry} />,
      );
      const retry = getByText("Повторити");
      expect(retry).toBeTruthy();
      fireEvent.press(retry);
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it("hides the retry button when `onRetry` is not provided", () => {
      mockStatus({});
      const { queryByText } = render(<SyncStatusIndicator error="Boom" />);
      expect(queryByText("Повторити")).toBeNull();
    });

    it("takes precedence over offline/syncing derived states", () => {
      mockStatus({ isOnline: false, queuedCount: 5 });
      const { getByText, queryByText } = render(
        <SyncStatusIndicator error="Boom" />,
      );
      expect(getByText("Помилка синхронізації")).toBeTruthy();
      expect(queryByText(/Офлайн/)).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — SyncStatusOverlay (CloudSyncContext provider wiring)
// ---------------------------------------------------------------------------

/**
 * Build a minimal stub `UseCloudSyncReturn` value that the overlay needs.
 * Fields unused by `SyncStatusOverlay` are left as safe-no-op stubs.
 */
function makeSync(
  syncError: string | null,
  pullAll: jest.Mock = jest.fn().mockResolvedValue(true),
): UseCloudSyncReturn {
  return {
    syncError,
    pullAll,
    isSyncing: false,
    hasError: !!syncError,
    lastSyncAt: null,
    state: "idle" as UseCloudSyncReturn["state"],
    syncErrorDetail: null as UseCloudSyncReturn["syncErrorDetail"],
    syncing: false,
    lastSync: null,
    pushAll: jest.fn().mockResolvedValue(undefined),
    migrationPending: false as const,
    uploadLocalData: jest.fn().mockResolvedValue(undefined),
    skipMigration: jest.fn(),
  };
}

describe("SyncStatusOverlay — CloudSyncContext provider wiring", () => {
  function renderWithContext(
    syncValue: UseCloudSyncReturn | null,
    isOnline = true,
    queuedCount = 0,
  ) {
    useSyncStatus.mockReturnValue({ isOnline, queuedCount, dirtyCount: 0 });
    return render(
      <CloudSyncContext.Provider value={syncValue}>
        <SyncStatusOverlay />
      </CloudSyncContext.Provider>,
    );
  }

  beforeEach(() => {
    stubAccessibility();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    useSyncStatus.mockReset();
  });

  describe("idle state", () => {
    it("shows no sync pill when the provider supplies no error and nothing is pending", () => {
      const { queryByText } = renderWithContext(makeSync(null));
      expect(queryByText("Синхронізація…")).toBeNull();
      expect(queryByText(/Офлайн/)).toBeNull();
      expect(queryByText("Помилка синхронізації")).toBeNull();
    });

    it("shows no sync pill when the provider value is null (not yet initialised)", () => {
      const { queryByText } = renderWithContext(null);
      expect(queryByText("Синхронізація…")).toBeNull();
      expect(queryByText(/Офлайн/)).toBeNull();
      expect(queryByText("Помилка синхронізації")).toBeNull();
    });
  });

  describe("syncing state", () => {
    it("shows 'Синхронізація…' and progressbar role when there is queued work", () => {
      const { getByText, UNSAFE_getByProps } = renderWithContext(
        makeSync(null),
        true,
        2,
      );
      expect(getByText("Синхронізація…")).toBeTruthy();
      expect(
        UNSAFE_getByProps({ accessibilityRole: "progressbar" }),
      ).toBeTruthy();
    });
  });

  describe("offline state", () => {
    it("shows 'Офлайн' and alert role when the device is offline", () => {
      const { getByText, UNSAFE_getByProps } = renderWithContext(
        makeSync(null),
        false,
      );
      expect(getByText("Офлайн")).toBeTruthy();
      expect(UNSAFE_getByProps({ accessibilityRole: "alert" })).toBeTruthy();
    });
  });

  describe("error state", () => {
    it("shows 'Помилка синхронізації' and alert role when the provider has a syncError", () => {
      const { getByText, UNSAFE_getByProps } = renderWithContext(
        makeSync("Network timeout"),
      );
      expect(getByText("Помилка синхронізації")).toBeTruthy();
      expect(UNSAFE_getByProps({ accessibilityRole: "alert" })).toBeTruthy();
    });

    it("shows the 'Повторити' retry button when the provider has a syncError", () => {
      const { getByText } = renderWithContext(makeSync("Offline"));
      expect(getByText("Повторити")).toBeTruthy();
    });

    it("pressing 'Повторити' calls pullAll from the context provider value", () => {
      const pullAll = jest.fn().mockResolvedValue(true);
      const { getByText } = renderWithContext(makeSync("Timeout", pullAll));
      fireEvent.press(getByText("Повторити"));
      expect(pullAll).toHaveBeenCalledTimes(1);
    });

    it("error state overrides offline + syncing derived state", () => {
      const { getByText, queryByText } = renderWithContext(
        makeSync("Fatal"),
        false,
        3,
      );
      expect(getByText("Помилка синхронізації")).toBeTruthy();
      expect(queryByText(/Офлайн/)).toBeNull();
      expect(queryByText("Синхронізація…")).toBeNull();
    });
  });

  describe("state transitions via provider re-render", () => {
    it("transitions from idle to error pill when provider pushes a syncError", () => {
      const { queryByText, rerender, getByText } = renderWithContext(
        makeSync(null),
      );
      expect(queryByText("Помилка синхронізації")).toBeNull();

      rerender(
        <CloudSyncContext.Provider value={makeSync("Connection lost")}>
          <SyncStatusOverlay />
        </CloudSyncContext.Provider>,
      );
      expect(getByText("Помилка синхронізації")).toBeTruthy();
    });

    it("transitions from error back to idle when provider clears syncError", () => {
      const pullAll = jest.fn().mockResolvedValue(true);
      const { getByText, rerender, queryByText } = renderWithContext(
        makeSync("Boom", pullAll),
      );
      expect(getByText("Помилка синхронізації")).toBeTruthy();

      rerender(
        <CloudSyncContext.Provider value={makeSync(null, pullAll)}>
          <SyncStatusOverlay />
        </CloudSyncContext.Provider>,
      );
      expect(queryByText("Помилка синхронізації")).toBeNull();
    });

    it("transitions through syncing → error → recovered in sequence", () => {
      const pullAll = jest.fn().mockResolvedValue(true);

      // Step 1: syncing (queued work, no error)
      useSyncStatus.mockReturnValue({
        isOnline: true,
        queuedCount: 2,
        dirtyCount: 0,
      });
      const { getByText, queryByText, rerender } = render(
        <CloudSyncContext.Provider value={makeSync(null, pullAll)}>
          <SyncStatusOverlay />
        </CloudSyncContext.Provider>,
      );
      expect(getByText("Синхронізація…")).toBeTruthy();

      // Step 2: error (provider pushes a syncError)
      useSyncStatus.mockReturnValue({
        isOnline: true,
        queuedCount: 0,
        dirtyCount: 0,
      });
      rerender(
        <CloudSyncContext.Provider value={makeSync("Server 500", pullAll)}>
          <SyncStatusOverlay />
        </CloudSyncContext.Provider>,
      );
      expect(getByText("Помилка синхронізації")).toBeTruthy();
      expect(queryByText("Синхронізація…")).toBeNull();

      // Step 3: recovered (error cleared, queue empty)
      rerender(
        <CloudSyncContext.Provider value={makeSync(null, pullAll)}>
          <SyncStatusOverlay />
        </CloudSyncContext.Provider>,
      );
      expect(queryByText("Помилка синхронізації")).toBeNull();
      expect(queryByText("Синхронізація…")).toBeNull();
    });
  });
});
