/**
 * Render smoke test for the Hub-core Settings shell.
 *
 * Keeps the scope tight: the shell renders the screen title and all
 * nine Hub-core section headers (General / Notifications / Routine /
 * Finyk / Fizruk / AIDigest / Assistant / Experimental / Account).
 * Section-level behaviour
 * is covered by the per-section suites.
 */

import { render } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiClientProvider } from "@sergeant/api-client/react";

import { apiClient } from "@/api/apiClient";
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

function renderPage() {
  // AccountSection calls `useQueryClient()`, so the shell needs a
  // QueryClientProvider in scope. A fresh client per render keeps the
  // smoke tests isolated.
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <ApiClientProvider client={apiClient}>
      <QueryClientProvider client={client}>
        <HubSettingsPage />
      </QueryClientProvider>
    </ApiClientProvider>,
  );
}

describe("HubSettingsPage", () => {
  it("renders the screen title and all section headers", () => {
    const { getByText } = renderPage();

    expect(getByText("Налаштування")).toBeTruthy();
    expect(getByText("Загальні")).toBeTruthy();
    expect(getByText("Сповіщення")).toBeTruthy();
    expect(getByText("Рутина")).toBeTruthy();
    expect(getByText("Фінік")).toBeTruthy();
    expect(getByText("Фізрук")).toBeTruthy();
    expect(getByText("AI Звіт тижня")).toBeTruthy();
    expect(getByText("Можливості асистента")).toBeTruthy();
    expect(getByText("Експериментальне")).toBeTruthy();
    expect(getByText("Акаунт")).toBeTruthy();
  });
});
