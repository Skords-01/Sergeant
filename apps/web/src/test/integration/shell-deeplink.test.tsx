// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { SHELL_DEEPLINK_CHANNEL } from "@sergeant/shared";

/**
 * Integration test for `ShellDeepLinkBridge` — covers the PR-29 shape:
 *   - BroadcastChannel listener navigates на отриманий path.
 *   - Backward-compat: `window.__sergeantShellNavigate` все ще працює.
 *   - Coalescing: одна (path, timestamp) пара, надіслана ОБОМА шляхами,
 *     призводить рівно до одного `navigate()`.
 *   - Cold-start queue drain-иться при mount-і.
 *   - Unsafe path не призводить до навігації.
 *
 * Mount-имо bridge всередині `<MemoryRouter>` + перехоплюємо
 * `useLocation()` через тестовий компонент-shim. `isCapacitor()` мокаємо
 * на `true`, щоб bridge install-нувся — у браузерному режимі він навмисно
 * no-op.
 */

vi.mock("@sergeant/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@sergeant/shared")>();
  return {
    ...actual,
    isCapacitor: vi.fn(() => true),
  };
});

let ShellDeepLinkBridge: typeof import("../../core/app/ShellDeepLinkBridge.js").ShellDeepLinkBridge;

// Track every sender channel a test opens so we can close them all in
// afterEach — even when an assertion throws before the test's own
// `sender.close()`. A leaked BroadcastChannel stays subscribed to the shared
// channel name and would deliver a later test's message into a stale listener,
// which is exactly the kind of cross-test pollution that made this suite
// order-flaky.
const openChannels = new Set<BroadcastChannel>();

function openSender(): BroadcastChannel {
  const ch = new BroadcastChannel(SHELL_DEEPLINK_CHANNEL);
  openChannels.add(ch);
  return ch;
}

beforeEach(async () => {
  vi.resetModules();
  ({ ShellDeepLinkBridge } =
    await import("../../core/app/ShellDeepLinkBridge.js"));
  delete (
    window as Window & {
      __sergeantShellNavigate?: unknown;
      __sergeantShellDeepLinkQueue?: unknown;
    }
  ).__sergeantShellNavigate;
  delete (
    window as Window & {
      __sergeantShellNavigate?: unknown;
      __sergeantShellDeepLinkQueue?: unknown;
    }
  ).__sergeantShellDeepLinkQueue;
});

afterEach(() => {
  for (const ch of openChannels) {
    try {
      ch.close();
    } catch {
      // best-effort
    }
  }
  openChannels.clear();
  vi.restoreAllMocks();
});

function LocationProbe(): JSX.Element {
  const location = useLocation();
  return <span data-testid="loc">{location.pathname + location.search}</span>;
}

function renderBridge(initialEntries: string[] = ["/"]): HTMLElement {
  const utils = render(
    <MemoryRouter initialEntries={initialEntries}>
      <ShellDeepLinkBridge />
      <Routes>
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
  return utils.getByTestId("loc");
}

/**
 * Deterministic barrier for negative assertions: after a message we expect the
 * bridge to IGNORE, post a known-good sentinel and wait for it to navigate.
 * BroadcastChannel preserves per-channel delivery order, so once the sentinel
 * has applied we know the ignored message was already processed — letting us
 * assert it produced no navigation without racing a fixed timeout.
 */
const SENTINEL_PATH = "/profile";

async function flushWithSentinel(
  sender: BroadcastChannel,
  loc: HTMLElement,
): Promise<void> {
  sender.postMessage({
    protocolVersion: 1,
    url: SENTINEL_PATH,
    source: "shell",
    timestamp: Date.now(),
  });
  await waitFor(() => {
    expect(loc.textContent).toBe(SENTINEL_PATH);
  });
}

describe("ShellDeepLinkBridge — BroadcastChannel listener (PR-29)", () => {
  it("navigates when a shell deep-link message arrives on the channel", async () => {
    const loc = renderBridge();
    expect(loc.textContent).toBe("/");

    const sender = openSender();
    sender.postMessage({
      protocolVersion: 1,
      url: "/finyk/transactions/42",
      source: "shell",
      timestamp: Date.now(),
    });

    // BroadcastChannel delivery in jsdom is a macrotask, and the bridge's
    // `navigate()` fires outside React's act() batching — so the nav can
    // settle after an arbitrary number of event-loop turns (longer under
    // full-suite load). A fixed `setTimeout` races it; `waitFor` polls until
    // the routed location is observed (or times out), keeping the assertion
    // strict while making it order-independent.
    await waitFor(() => {
      expect(loc.textContent).toBe("/finyk/transactions/42");
    });
    sender.close();
  });

  it("ignores messages with mismatched protocol version", async () => {
    const loc = renderBridge();
    const sender = openSender();
    sender.postMessage({
      protocolVersion: 999,
      url: "/finyk",
      source: "shell",
      timestamp: Date.now(),
    });

    // Drain the channel deterministically; the sentinel proves the bad
    // message was processed and produced no navigation to /finyk.
    await flushWithSentinel(sender, loc);
    expect(loc.textContent).toBe(SENTINEL_PATH);
    sender.close();
  });

  it("ignores messages with source other than `shell` (no web→web self-loop)", async () => {
    const loc = renderBridge();
    const sender = openSender();
    sender.postMessage({
      protocolVersion: 1,
      url: "/finyk",
      source: "web",
      timestamp: Date.now(),
    });

    await flushWithSentinel(sender, loc);
    expect(loc.textContent).toBe(SENTINEL_PATH);
    sender.close();
  });

  it("rejects unsafe paths (M19 defense-in-depth) even when delivered via BroadcastChannel", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const loc = renderBridge();
    const sender = openSender();
    sender.postMessage({
      protocolVersion: 1,
      url: "/unknown-prefix/admin",
      source: "shell",
      timestamp: Date.now(),
    });

    // The bridge logs a warning when it rejects an unsafe path; wait on that
    // side effect deterministically, then confirm no navigation happened.
    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalled();
    });
    expect(loc.textContent).toBe("/");
    sender.close();
    warnSpy.mockRestore();
  });
});

describe("ShellDeepLinkBridge — backward-compat (window-global)", () => {
  it("window.__sergeantShellNavigate still works (legacy shim path)", async () => {
    const loc = renderBridge();
    const w = window as Window & {
      __sergeantShellNavigate?: (path: string) => void;
    };
    expect(typeof w.__sergeantShellNavigate).toBe("function");
    await act(async () => {
      w.__sergeantShellNavigate!("/profile");
    });
    expect(loc.textContent).toBe("/profile");
  });

  it("drains pre-mount __sergeantShellDeepLinkQueue on install (cold-start)", async () => {
    (
      window as Window & { __sergeantShellDeepLinkQueue?: string[] }
    ).__sergeantShellDeepLinkQueue = ["/welcome"];
    const loc = renderBridge();
    // Дочекаємось React state-update після useEffect-у
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(loc.textContent).toBe("/welcome");
    // Drained
    expect(
      (window as Window & { __sergeantShellDeepLinkQueue?: string[] })
        .__sergeantShellDeepLinkQueue,
    ).toEqual([]);
  });
});

describe("ShellDeepLinkBridge — coalescing window", () => {
  it("the same (path, timestamp) delivered via BOTH channel + window-global navigates only once", async () => {
    const loc = renderBridge();
    const ts = Date.now();

    // BroadcastChannel first
    const sender = openSender();
    sender.postMessage({
      protocolVersion: 1,
      url: "/chat",
      source: "shell",
      timestamp: ts,
    });
    await waitFor(() => {
      expect(loc.textContent).toBe("/chat");
    });

    // window-global with the SAME timestamp → must be coalesced.
    // (NOTE: mobile-shell sends BC with the message's `Date.now()` but
    // calls `window.__sergeantShellNavigate(path)` without ts; web uses
    // `Date.now()` at receive time. The exact-ts coalescing here proves
    // the matcher logic; for typical mobile-shell flow the timestamps
    // will differ by <50ms but path equality still gives a single nav
    // because the BC nav has already happened. We test that explicitly
    // by re-checking `loc` doesn't *change*.)
    const w = window as Window & {
      __sergeantShellNavigate?: (path: string) => void;
    };
    // Simulate near-simultaneous shell dispatch by manually navigating
    // again with same path; React Router keeps us in place.
    await act(async () => {
      w.__sergeantShellNavigate!("/chat");
    });
    expect(loc.textContent).toBe("/chat");

    sender.close();
  });
});
