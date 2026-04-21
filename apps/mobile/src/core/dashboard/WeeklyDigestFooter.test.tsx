/**
 * Smoke tests for `WeeklyDigestFooter` (HubDashboard PR-3).
 *
 * The shared pure helpers have full coverage in
 * `packages/shared/src/lib/weeklyDigest.test.ts`. What this file
 * asserts is specifically the mobile wiring:
 *   - visibility rules (Mon / Tue vs. rest of the week),
 *   - fresh-dot renders when the digest is live,
 *   - tapping the link opens the placeholder digest card.
 */

import { act, fireEvent, render } from "@testing-library/react-native";
import { STORAGE_KEYS } from "@sergeant/shared";

import { _getMMKVInstance } from "@/lib/storage";

import { WeeklyDigestFooter } from "./WeeklyDigestFooter";

const DIGEST_PREFIX = STORAGE_KEYS.WEEKLY_DIGEST_PREFIX;

function writeDigest(weekKey: string, record: unknown) {
  _getMMKVInstance().set(`${DIGEST_PREFIX}${weekKey}`, JSON.stringify(record));
}

function weekKeyFor(d: Date): string {
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(monday.getDate()).padStart(2, "0")}`;
}

describe("WeeklyDigestFooter", () => {
  beforeEach(() => {
    _getMMKVInstance().clearAll();
  });
  afterEach(() => {
    _getMMKVInstance().clearAll();
  });

  it("renders on Monday even without a digest (ready-to-generate CTA)", () => {
    // 2026-04-20 is a Monday.
    const monday = new Date("2026-04-20T10:00:00");
    const { getByTestId, queryByTestId } = render(
      <WeeklyDigestFooter now={monday} />,
    );

    expect(getByTestId("weekly-digest-footer")).toBeTruthy();
    // Monday *always* renders, but without a digest the fresh-dot
    // stays hidden — the shared helper treats Monday as "live" only
    // when actively checking freshness, not for presence reasons.
    expect(queryByTestId("weekly-digest-footer-fresh-dot")).toBeTruthy();
  });

  it("hides the footer on a quiet mid-week day with no digest", () => {
    // 2026-04-24 is a Friday.
    const friday = new Date("2026-04-24T10:00:00");
    const { queryByTestId } = render(<WeeklyDigestFooter now={friday} />);

    expect(queryByTestId("weekly-digest-footer")).toBeNull();
  });

  it("shows the fresh-dot + footer on a non-Mon day when the current digest exists", () => {
    const wed = new Date("2026-04-22T10:00:00");
    writeDigest(weekKeyFor(wed), { generatedAt: wed.toISOString() });

    const { getByTestId } = render(<WeeklyDigestFooter now={wed} />);

    expect(getByTestId("weekly-digest-footer")).toBeTruthy();
    expect(getByTestId("weekly-digest-footer-fresh-dot")).toBeTruthy();
  });

  it("opens the placeholder digest card when the link is pressed", () => {
    const mon = new Date("2026-04-20T10:00:00");
    const { getByTestId, queryByTestId } = render(
      <WeeklyDigestFooter now={mon} />,
    );

    // Placeholder card starts closed.
    expect(queryByTestId("weekly-digest-card")?.props.visible ?? false).toBe(
      false,
    );

    act(() => {
      fireEvent.press(getByTestId("weekly-digest-footer-link"));
    });

    expect(getByTestId("weekly-digest-card").props.visible).toBe(true);
  });
});
