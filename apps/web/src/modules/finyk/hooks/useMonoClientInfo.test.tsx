// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ApiError } from "@shared/api";

vi.mock("@shared/api", async () => {
  const actual =
    await vi.importActual<typeof import("@shared/api")>("@shared/api");
  return {
    ...actual,
    monoApi: {
      clientInfo: vi.fn(),
      statement: vi.fn(),
    },
  };
});

import { monoApi } from "@shared/api";
import { useMonoClientInfo } from "./useMonoClientInfo";

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

const mockedClientInfo = monoApi.clientInfo as unknown as ReturnType<
  typeof vi.fn
>;

describe("useMonoClientInfo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("не робить запит, поки token порожній", async () => {
    const { result } = renderHook(() => useMonoClientInfo(""), {
      wrapper: makeWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockedClientInfo).not.toHaveBeenCalled();
  });

  it("повертає клієнтську інформацію при валідному токені", async () => {
    const info = {
      clientId: "cl_123",
      name: "Тест",
      accounts: [{ id: "a1", currencyCode: 980 }],
    };
    mockedClientInfo.mockResolvedValueOnce(info);

    const { result } = renderHook(() => useMonoClientInfo("TOKEN_A"), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(info);
    expect(mockedClientInfo).toHaveBeenCalledTimes(1);
    expect(mockedClientInfo).toHaveBeenCalledWith(
      "TOKEN_A",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("не ретраїть auth-помилки (401/403)", async () => {
    const authError = new ApiError({
      kind: "http",
      status: 401,
      message: "Unauthorized",
      url: "/api/mono",
    });
    mockedClientInfo.mockRejectedValue(authError);

    // Використовуємо свій клієнт з retry=1, щоб перевірити саме наш guard.
    const client = new QueryClient({
      defaultOptions: { queries: { retry: 3 } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useMonoClientInfo("TOKEN_B"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockedClientInfo).toHaveBeenCalledTimes(1);
  });
});
