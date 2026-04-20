// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, render, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// The Better Auth actions layer is irrelevant to AuthContext's source of
// truth — we stub the whole `authClient` module so tests don't hit the
// network and we can assert which action was invoked.
type AuthResult = { data: unknown; error: { message?: string } | null };
const ok = (): AuthResult => ({ data: {}, error: null });
const signInEmail: ReturnType<
  typeof vi.fn<
    (args: { email: string; password: string }) => Promise<AuthResult>
  >
> = vi.fn(async () => ok());
const signUpEmail: ReturnType<
  typeof vi.fn<
    (args: {
      email: string;
      password: string;
      name: string;
    }) => Promise<AuthResult>
  >
> = vi.fn(async () => ok());
const signOut: ReturnType<typeof vi.fn<() => Promise<void>>> = vi.fn(
  async () => undefined,
);
const forgetPassword: ReturnType<
  typeof vi.fn<
    (args: { email: string; redirectTo?: string }) => Promise<AuthResult>
  >
> = vi.fn(async () => ok());

vi.mock("./authClient.js", () => ({
  signIn: {
    email: (args: { email: string; password: string }) => signInEmail(args),
  },
  signUp: {
    email: (args: { email: string; password: string; name: string }) =>
      signUpEmail(args),
  },
  signOut: () => signOut(),
  forgetPassword: (args: { email: string; redirectTo?: string }) =>
    forgetPassword(args),
}));

// Mock `useUser` from `@sergeant/api-client/react`. The AuthContext must
// drive off this hook — NOT off `better-auth/react#useSession`. The mock
// keeps `apiQueryKeys` intact so invalidation assertions can compare
// against the real query key tuple.
const useUserMock = vi.fn();

vi.mock("@sergeant/api-client/react", async () => {
  const real = await vi.importActual<
    typeof import("@sergeant/api-client/react")
  >("@sergeant/api-client/react");
  return {
    ...real,
    useUser: (opts?: unknown) => useUserMock(opts),
  };
});

import { AuthProvider, useAuth } from "./AuthContext.js";
import { apiQueryKeys } from "@sergeant/api-client/react";

interface UseUserState {
  data?:
    | {
        user: {
          id: string;
          email: string | null;
          name: string | null;
          image: string | null;
          emailVerified: boolean;
        };
      }
    | undefined;
  isLoading?: boolean;
  error?: unknown;
}

function setUser(state: UseUserState) {
  useUserMock.mockReturnValue({
    data: state.data,
    isLoading: state.isLoading ?? false,
    error: state.error ?? null,
  });
}

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidateSpy = vi.spyOn(client, "invalidateQueries");
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    );
  }
  return { Wrapper, client, invalidateSpy };
}

const SAMPLE_USER = {
  id: "u-1",
  email: "a@b.c",
  name: "A",
  image: null,
  emailVerified: true,
};

describe("AuthContext", () => {
  beforeEach(() => {
    signInEmail.mockClear();
    signUpEmail.mockClear();
    signOut.mockClear();
    forgetPassword.mockClear();
    useUserMock.mockReset();
  });

  it("drives `user`/`status` off useUser() — not better-auth/useSession", () => {
    setUser({ data: { user: SAMPLE_USER } });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });
    expect(useUserMock).toHaveBeenCalled();
    expect(result.current.user).toEqual(SAMPLE_USER);
    expect(result.current.status).toBe("authenticated");
    expect(result.current.isLoading).toBe(false);
  });

  it("reports `loading` while useUser() is pending", () => {
    setUser({ data: undefined, isLoading: true });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.status).toBe("loading");
    expect(result.current.user).toBeNull();
  });

  it("reports `unauthenticated` when useUser() has no user", () => {
    setUser({ data: undefined, isLoading: false });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });
    expect(result.current.status).toBe("unauthenticated");
    expect(result.current.user).toBeNull();
  });

  it("invalidates apiQueryKeys.me.current() after successful login", async () => {
    setUser({ data: undefined });
    const { Wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });
    await act(async () => {
      const ok = await result.current.login("a@b.c", "pw");
      expect(ok).toBe(true);
    });
    expect(signInEmail).toHaveBeenCalledWith({
      email: "a@b.c",
      password: "pw",
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: apiQueryKeys.me.current(),
    });
  });

  it("surfaces login error and does NOT invalidate me on failure", async () => {
    setUser({ data: undefined });
    signInEmail.mockResolvedValueOnce({
      data: null,
      error: { message: "Bad credentials" },
    } as unknown as Awaited<ReturnType<typeof signInEmail>>);
    const { Wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });
    await act(async () => {
      const ok = await result.current.login("a@b.c", "wrong");
      expect(ok).toBe(false);
    });
    expect(result.current.authError).toBe("Bad credentials");
    expect(invalidateSpy).not.toHaveBeenCalledWith({
      queryKey: apiQueryKeys.me.current(),
    });
  });

  it("invalidates apiQueryKeys.me.current() after successful register", async () => {
    setUser({ data: undefined });
    const { Wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });
    await act(async () => {
      const ok = await result.current.register("a@b.c", "pw", "A");
      expect(ok).toBe(true);
    });
    expect(signUpEmail).toHaveBeenCalledWith({
      email: "a@b.c",
      password: "pw",
      name: "A",
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: apiQueryKeys.me.current(),
    });
  });

  it("invalidates apiQueryKeys.me.current() on logout, even if signOut throws", async () => {
    setUser({ data: { user: SAMPLE_USER } });
    signOut.mockRejectedValueOnce(new Error("network down"));
    const { Wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.logout();
    });
    expect(signOut).toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: apiQueryKeys.me.current(),
    });
  });

  it("refresh() invalidates apiQueryKeys.me.current()", async () => {
    setUser({ data: { user: SAMPLE_USER } });
    const { Wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.refresh();
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: apiQueryKeys.me.current(),
    });
  });

  it("requestPasswordReset delegates to Better Auth without invalidating me", async () => {
    setUser({ data: undefined });
    const { Wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });
    await act(async () => {
      const ok = await result.current.requestPasswordReset("a@b.c");
      expect(ok).toBe(true);
    });
    expect(forgetPassword).toHaveBeenCalled();
    // Reset doesn't change identity, so me-cache must stay untouched.
    expect(invalidateSpy).not.toHaveBeenCalledWith({
      queryKey: apiQueryKeys.me.current(),
    });
  });

  it("useAuth() throws when used outside AuthProvider", () => {
    setUser({ data: undefined });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useAuth())).toThrow(
      /useAuth must be used within AuthProvider/,
    );
    spy.mockRestore();
  });

  it("reflects useUser() transitions across logout/login (new user profile surfaces)", async () => {
    setUser({ data: { user: { ...SAMPLE_USER, id: "u-1", name: "One" } } });
    const { Wrapper } = makeWrapper();

    function Probe() {
      const { user, status } = useAuth();
      return (
        <div data-testid="probe">
          {status}:{user?.id ?? ""}:{user?.name ?? ""}
        </div>
      );
    }

    const { getByTestId, rerender } = render(
      <Wrapper>
        <Probe />
      </Wrapper>,
    );
    await waitFor(() =>
      expect(getByTestId("probe").textContent).toBe("authenticated:u-1:One"),
    );

    // Simulate logout: useUser() now returns no user.
    setUser({ data: undefined });
    rerender(
      <Wrapper>
        <Probe />
      </Wrapper>,
    );
    await waitFor(() =>
      expect(getByTestId("probe").textContent).toBe("unauthenticated::"),
    );

    // Simulate a new sign-in: useUser() now returns a different user.
    setUser({
      data: { user: { ...SAMPLE_USER, id: "u-2", name: "Two" } },
    });
    rerender(
      <Wrapper>
        <Probe />
      </Wrapper>,
    );
    await waitFor(() =>
      expect(getByTestId("probe").textContent).toBe("authenticated:u-2:Two"),
    );
  });
});
