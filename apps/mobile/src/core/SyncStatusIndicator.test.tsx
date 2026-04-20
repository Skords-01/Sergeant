/**
 * Render tests for `<SyncStatusIndicator>`.
 *
 * `useSyncStatus` is mocked so each state (`idle` / `syncing` /
 * `offline` / `error`) can be asserted in isolation without standing
 * up the whole CloudSync stack. `AccessibilityInfo` is stubbed to
 * match `Skeleton.test.tsx` — we don't exercise the animated pulse,
 * only its presence + accessibility affordances.
 */
import { fireEvent, render } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";

import { SyncStatusIndicator } from "./SyncStatusIndicator";

jest.mock("@/sync/hook/useSyncStatus", () => ({
  useSyncStatus: jest.fn(),
}));

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

describe("SyncStatusIndicator", () => {
  beforeEach(() => {
    jest
      .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
      .mockResolvedValue(false);
    jest
      .spyOn(AccessibilityInfo, "addEventListener")
      .mockImplementation(() => ({ remove: () => {} }) as never);
  });

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
