/**
 * Render smoke test for the Hub-core Settings shell.
 *
 * Keeps the scope tight: the shell renders the screen title, the four
 * first-cut section headers (General / Notifications / Routine /
 * Experimental), and each of the "буде портовано" placeholders for
 * sections that still need porting. Section-level behaviour is
 * covered by the per-section suites.
 */

import { render } from "@testing-library/react-native";

import { _getMMKVInstance } from "@/lib/storage";

import { HubSettingsPage } from "./HubSettingsPage";

jest.mock("expo-notifications", () => ({
  __esModule: true,
  IosAuthorizationStatus: { PROVISIONAL: 3 },
  getPermissionsAsync: jest.fn(() =>
    Promise.resolve({ granted: false, status: "undetermined" }),
  ),
  requestPermissionsAsync: jest.fn(() =>
    Promise.resolve({ granted: true, status: "granted" }),
  ),
}));

jest.mock("react-native-safe-area-context", () => {
  const actual = jest.requireActual("react-native-safe-area-context");
  return {
    ...actual,
    SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  };
});

beforeEach(() => {
  _getMMKVInstance().clearAll();
});

describe("HubSettingsPage", () => {
  it("renders the screen title and all first-cut section headers", () => {
    const { getByText } = render(<HubSettingsPage />);

    expect(getByText("Налаштування")).toBeTruthy();
    expect(getByText("Загальні")).toBeTruthy();
    expect(getByText("Сповіщення")).toBeTruthy();
    expect(getByText("Рутина")).toBeTruthy();
    expect(getByText("Експериментальне")).toBeTruthy();
  });

  it("renders placeholders for the not-yet-ported sections", () => {
    const { getByText, getAllByText } = render(<HubSettingsPage />);

    for (const title of ["AI-дайджести", "Фізрук", "Фінік"]) {
      expect(getByText(title)).toBeTruthy();
    }
    // Three placeholders share the same "Скоро" chip + caption after
    // GeneralSection and NotificationsSection took over their spots.
    expect(getAllByText("Скоро")).toHaveLength(3);
    expect(getAllByText("Буде портовано у наступному PR.")).toHaveLength(3);
  });
});
