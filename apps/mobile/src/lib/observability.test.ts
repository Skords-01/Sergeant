/**
 * Jest coverage for `initObservability` / `captureError` —
 * gating behaviour around `EXPO_PUBLIC_SENTRY_DSN`, Sentry handoff
 * when the DSN is set, and the `console.error` fallback in no-op mode.
 *
 * The DSN read lives in `./observability/env` so we can `jest.mock`
 * it here without fighting Expo's babel `EXPO_PUBLIC_*` env-inlining
 * plugin. `@sentry/react-native` is also mocked at module level so
 * we don't boot the native RNSentry bridge (unavailable under
 * jest-expo's node-side preset).
 */

jest.mock("@sentry/react-native", () => ({
  __esModule: true,
  init: jest.fn(),
  captureException: jest.fn(),
}));

jest.mock("./observability/env", () => ({
  __esModule: true,
  getSentryDsn: jest.fn(),
}));

import * as Sentry from "@sentry/react-native";

import {
  __resetObservabilityForTests,
  captureError,
  initObservability,
} from "./observability";
import { getSentryDsn } from "./observability/env";

const initMock = Sentry.init as jest.Mock;
const captureExceptionMock = Sentry.captureException as jest.Mock;
const getSentryDsnMock = getSentryDsn as jest.Mock;

describe("observability", () => {
  let consoleErrorSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    __resetObservabilityForTests();
    initMock.mockReset();
    captureExceptionMock.mockReset();
    getSentryDsnMock.mockReset();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe("initObservability", () => {
    it("is a no-op when EXPO_PUBLIC_SENTRY_DSN is absent and logs a diagnostic", () => {
      getSentryDsnMock.mockReturnValue(undefined);

      initObservability();

      expect(initMock).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[observability] sentry disabled (no DSN)",
      );
    });

    it("is a no-op when EXPO_PUBLIC_SENTRY_DSN is an empty string", () => {
      getSentryDsnMock.mockReturnValue("");

      initObservability();

      expect(initMock).not.toHaveBeenCalled();
    });

    it("calls Sentry.init with the DSN and the expected scaffold config when DSN is set", () => {
      getSentryDsnMock.mockReturnValue("https://example@sentry.io/1");

      initObservability();

      expect(initMock).toHaveBeenCalledTimes(1);
      const arg = initMock.mock.calls[0][0] as {
        dsn: string;
        enableAutoSessionTracking: boolean;
        tracesSampleRate: number;
      };
      expect(arg.dsn).toBe("https://example@sentry.io/1");
      expect(arg.enableAutoSessionTracking).toBe(true);
      expect(arg.tracesSampleRate).toBe(0);
    });

    it("is idempotent — re-entry does not re-init Sentry", () => {
      getSentryDsnMock.mockReturnValue("https://example@sentry.io/1");

      initObservability();
      initObservability();
      initObservability();

      expect(initMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("captureError", () => {
    it("falls back to console.error when Sentry is not initialised", () => {
      getSentryDsnMock.mockReturnValue(undefined);
      initObservability(); // no-op path

      const err = new Error("boom");
      captureError(err, { componentStack: "stack" });

      expect(captureExceptionMock).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[observability] captureError",
        err,
        { componentStack: "stack" },
      );
    });

    it("forwards to Sentry.captureException with extras when Sentry is initialised", () => {
      getSentryDsnMock.mockReturnValue("https://example@sentry.io/1");
      initObservability();

      const err = new Error("kaboom");
      captureError(err, { foo: "bar" });

      expect(captureExceptionMock).toHaveBeenCalledTimes(1);
      expect(captureExceptionMock).toHaveBeenCalledWith(err, {
        extra: { foo: "bar" },
      });
      // Must not also hit console.error on the happy path.
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it("falls back to console.error if Sentry.captureException throws", () => {
      getSentryDsnMock.mockReturnValue("https://example@sentry.io/1");
      initObservability();
      captureExceptionMock.mockImplementationOnce(() => {
        throw new Error("sentry down");
      });

      const err = new Error("kaboom");
      captureError(err);

      expect(captureExceptionMock).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[observability] captureError",
        err,
        undefined,
      );
    });

    it("accepts a missing context argument without throwing", () => {
      getSentryDsnMock.mockReturnValue(undefined);
      initObservability();

      expect(() => captureError(new Error("x"))).not.toThrow();
    });
  });
});
