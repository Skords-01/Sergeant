// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const flagState = { value: false };

vi.mock("../lib/featureFlags", () => ({
  useFlag: () => flagState.value,
}));

vi.mock("@shared/api", async () => {
  const actual =
    await vi.importActual<typeof import("@shared/api")>("@shared/api");
  return {
    ...actual,
    monoWebhookApi: {
      syncState: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      backfill: vi.fn(),
      accounts: vi.fn(),
      transactions: vi.fn(),
    },
    privatApi: {
      balanceFinal: vi.fn(),
    },
    isApiError: actual.isApiError,
  };
});

vi.mock("../../modules/finyk/hooks/useStorage", () => ({
  useStorage: () => ({
    hiddenAccounts: [],
    toggleHideAccount: vi.fn(),
    customCategories: [],
    addCustomCategory: vi.fn(),
    removeCustomCategory: vi.fn(),
  }),
}));

vi.mock("../../modules/finyk/utils", () => ({
  getAccountLabel: (acc: { id: string }) => `Account ${acc.id}`,
}));

import { monoWebhookApi } from "@shared/api";
import { FinykSection } from "./FinykSection";

const mockedSyncState = monoWebhookApi.syncState as unknown as ReturnType<
  typeof vi.fn
>;
const mockedConnect = monoWebhookApi.connect as unknown as ReturnType<
  typeof vi.fn
>;

function renderWithProviders() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <FinykSection />
    </QueryClientProvider>,
  );
}

describe("FinykSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    flagState.value = false;
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
  });

  it("renders legacy monobank section when flag is off and info cache exists", () => {
    localStorage.setItem(
      "finyk_info_cache",
      JSON.stringify({
        info: {
          name: "Тест Юзер",
          accounts: [
            { id: "acc1", currencyCode: 980, balance: 50000, creditLimit: 0 },
          ],
        },
      }),
    );
    localStorage.setItem("finyk_token", "test-token");
    flagState.value = false;

    renderWithProviders();

    expect(screen.getByText("Тест Юзер")).toBeTruthy();
    expect(screen.getByText(/UAH рахунків/)).toBeTruthy();
  });

  it("renders webhook connect form when flag is on and disconnected", async () => {
    flagState.value = true;
    mockedSyncState.mockResolvedValue({
      status: "disconnected",
      webhookActive: false,
      lastEventAt: null,
      lastBackfillAt: null,
      accountsCount: 0,
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText(/Токен відправляється на сервер/)).toBeTruthy();
    });
    expect(screen.getByPlaceholderText("Токен Monobank API")).toBeTruthy();
    expect(screen.getByText("Підключити Monobank")).toBeTruthy();
  });

  it("renders webhook status when flag is on and connected", async () => {
    flagState.value = true;
    mockedSyncState.mockResolvedValue({
      status: "active",
      webhookActive: true,
      lastEventAt: "2024-03-15T12:00:00Z",
      lastBackfillAt: null,
      accountsCount: 3,
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Webhook active")).toBeTruthy();
    });
    expect(screen.getByText(/3 рахунків/)).toBeTruthy();
    expect(screen.getByText("Re-sync (backfill)")).toBeTruthy();
  });

  it("calls monoWebhookApi.connect when submit in webhook mode", async () => {
    flagState.value = true;
    mockedSyncState.mockResolvedValue({
      status: "disconnected",
      webhookActive: false,
      lastEventAt: null,
      lastBackfillAt: null,
      accountsCount: 0,
    });
    mockedConnect.mockResolvedValue({ status: "active", accountsCount: 1 });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Токен Monobank API")).toBeTruthy();
    });

    const input = screen.getByPlaceholderText("Токен Monobank API");
    fireEvent.change(input, { target: { value: "my-webhook-token" } });

    const btn = screen.getByText("Підключити Monobank");
    fireEvent.click(btn);

    await waitFor(() => {
      expect(mockedConnect).toHaveBeenCalledWith("my-webhook-token");
    });

    // Token must NOT be stored in browser
    expect(localStorage.getItem("finyk_token")).toBeNull();
    expect(sessionStorage.getItem("finyk_token")).toBeNull();
  });

  it("hides legacy token display when webhook flag is on", async () => {
    localStorage.setItem(
      "finyk_info_cache",
      JSON.stringify({
        info: { name: "Тест", accounts: [] },
      }),
    );
    localStorage.setItem("finyk_token", "secret-token-abc");
    flagState.value = true;
    mockedSyncState.mockResolvedValue({
      status: "disconnected",
      webhookActive: false,
      lastEventAt: null,
      lastBackfillAt: null,
      accountsCount: 0,
    });

    renderWithProviders();

    // Wait for webhook section to render
    await waitFor(() => {
      expect(screen.getByText(/Токен відправляється на сервер/)).toBeTruthy();
    });

    // Legacy Monobank section should not render the client name
    expect(screen.queryByText("Тест Юзер")).toBeNull();
    // Legacy token section should not be visible
    expect(screen.queryByText(/secret-token/)).toBeNull();
  });
});
