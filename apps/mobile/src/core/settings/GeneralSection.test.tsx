/**
 * Render tests for `<GeneralSection>`.
 *
 * Covers:
 *  - collapsed-by-default header with the "Загальні" title;
 *  - expanding reveals the two active toggles ("Темна тема" +
 *    "Показувати AI-коуч") plus the three deferred sub-group
 *    placeholders (Dashboard reorder / Cloud sync / Backup);
 *  - toggling "Темна тема" persists `darkMode` into the shared
 *    `hub_prefs_v1` MMKV slice;
 *  - toggling "Показувати AI-коуч" persists `showCoach` with the
 *    web-compatible default-on semantics (`prefs.showCoach !== false`).
 */

import { fireEvent, render } from "@testing-library/react-native";
import { STORAGE_KEYS } from "@sergeant/shared";

import { _getMMKVInstance } from "@/lib/storage";

import { GeneralSection } from "./GeneralSection";

beforeEach(() => {
  _getMMKVInstance().clearAll();
});

describe("GeneralSection", () => {
  it("renders the collapsed group header", () => {
    const { getByText, queryByText } = render(<GeneralSection />);
    expect(getByText("Загальні")).toBeTruthy();
    // Toggle labels are hidden until the group is expanded.
    expect(queryByText("Темна тема")).toBeNull();
    expect(queryByText("Показувати AI-коуч")).toBeNull();
  });

  it("expands to reveal active toggles and deferred sub-group notices", () => {
    const { getByText, getAllByText } = render(<GeneralSection />);

    fireEvent.press(getByText("Загальні"));

    expect(getByText("Темна тема")).toBeTruthy();
    expect(getByText("Показувати AI-коуч")).toBeTruthy();

    // Three deferred sub-groups render their Ukrainian-language titles.
    expect(getByText("Дашборд")).toBeTruthy();
    expect(getByText("Упорядкувати модулі")).toBeTruthy();
    expect(getByText("Хмарна синхронізація")).toBeTruthy();
    expect(getByText("Резервна копія Hub")).toBeTruthy();

    // Sanity: at least one deferred notice is visible.
    expect(
      getAllByText("Перенесення доступне після порту Dashboard.").length,
    ).toBeGreaterThan(0);
  });

  it("persists the dark-mode pref into the shared hub_prefs_v1 slice", () => {
    const { getByText, getByTestId } = render(<GeneralSection />);
    fireEvent.press(getByText("Загальні"));

    fireEvent(getByTestId("general-dark-mode-toggle"), "valueChange", true);

    const stored = _getMMKVInstance().getString(STORAGE_KEYS.HUB_PREFS);
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored as string)).toMatchObject({ darkMode: true });
  });

  it("persists the show-coach pref with web-compatible default-on semantics", () => {
    const { getByText, getByTestId } = render(<GeneralSection />);
    fireEvent.press(getByText("Загальні"));

    // Default: the toggle is on (mirrors web `showCoach !== false`).
    // Turning it off should persist `showCoach: false` explicitly.
    fireEvent(getByTestId("general-show-coach-toggle"), "valueChange", false);

    const stored = _getMMKVInstance().getString(STORAGE_KEYS.HUB_PREFS);
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored as string)).toMatchObject({ showCoach: false });
  });
});
