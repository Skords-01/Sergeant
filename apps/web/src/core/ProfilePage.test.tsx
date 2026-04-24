// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ── Mocks ────────────────────────────────────────────────────

const updateUserMock = vi.fn(async () => ({ error: null }));
const changePasswordMock = vi.fn(async () => ({ error: null }));
const listSessionsMock = vi.fn(async () => ({ data: [] }));
const revokeSessionMock = vi.fn(async () => ({ error: null }));
const deleteUserMock = vi.fn(async () => ({ error: null }));
const signOutMock = vi.fn(async () => undefined);

vi.mock("./authClient.js", () => ({
  updateUser: (...args: unknown[]) => updateUserMock(...args),
  changePassword: (...args: unknown[]) => changePasswordMock(...args),
  listSessions: () => listSessionsMock(),
  revokeSession: (...args: unknown[]) => revokeSessionMock(...args),
  deleteUser: (...args: unknown[]) => deleteUserMock(...args),
  signOut: () => signOutMock(),
}));

const useOnlineStatusMock = vi.fn(() => true);
vi.mock("@shared/hooks/useOnlineStatus", () => ({
  useOnlineStatus: () => useOnlineStatusMock(),
}));

const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
vi.mock("@shared/hooks/useToast", () => ({
  useToast: () => ({ success: toastSuccessMock, error: toastErrorMock }),
}));

const mockUser = {
  id: "u-1",
  email: "test@example.com",
  name: "Тест",
  image: null as string | null,
  emailVerified: true,
};
const refreshMock = vi.fn(async () => undefined);
const logoutMock = vi.fn(async () => undefined);

vi.mock("./AuthContext.jsx", () => ({
  useAuth: () => ({
    user: mockUser,
    logout: logoutMock,
    refresh: refreshMock,
    isLoading: false,
    status: "authenticated",
  }),
}));

import { ProfilePage } from "./ProfilePage";

function renderPage() {
  return render(
    <MemoryRouter>
      <ProfilePage />
    </MemoryRouter>,
  );
}

// ── Tests ────────────────────────────────────────────────────

describe("ProfilePage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    useOnlineStatusMock.mockReturnValue(true);
    mockUser.image = null;
    mockUser.name = "Тест";
    mockUser.emailVerified = true;
  });

  describe("rendering", () => {
    it("shows user name and email", () => {
      renderPage();
      expect(screen.getByText("Тест")).toBeInTheDocument();
      expect(screen.getByText("test@example.com")).toBeInTheDocument();
    });

    it("shows verified badge when emailVerified is true", () => {
      renderPage();
      const badges = screen.getAllByText("Підтверджено");
      expect(badges.length).toBeGreaterThanOrEqual(1);
    });

    it("hides verified badge when emailVerified is false", () => {
      mockUser.emailVerified = false;
      renderPage();
      expect(screen.queryByText("Підтверджено")).not.toBeInTheDocument();
    });

    it("shows initial letter when no avatar image", () => {
      renderPage();
      const avatarBtns = screen.getAllByLabelText("Змінити аватар");
      expect(within(avatarBtns[0]).getByText("Т")).toBeInTheDocument();
    });

    it("shows avatar image when user.image is set", () => {
      mockUser.image = "data:image/webp;base64,abc";
      renderPage();
      const avatarBtns = screen.getAllByLabelText("Змінити аватар");
      const img = avatarBtns[0].querySelector("img");
      expect(img).toBeTruthy();
      expect(img!.getAttribute("src")).toBe("data:image/webp;base64,abc");
    });

    it("shows remove photo link when avatar is set", () => {
      mockUser.image = "data:image/webp;base64,abc";
      renderPage();
      const links = screen.getAllByText("Видалити фото");
      expect(links.length).toBeGreaterThanOrEqual(1);
    });

    it("hides remove photo link when no avatar", () => {
      renderPage();
      expect(screen.queryByText("Видалити фото")).not.toBeInTheDocument();
    });
  });

  describe("offline UX", () => {
    it("shows offline warning banner when offline", () => {
      useOnlineStatusMock.mockReturnValue(false);
      renderPage();
      expect(
        screen.getByText(
          "Ви офлайн — редагування профілю тимчасово недоступне",
        ),
      ).toBeInTheDocument();
    });

    it("hides offline warning banner when online", () => {
      useOnlineStatusMock.mockReturnValue(true);
      renderPage();
      expect(
        screen.queryByText(
          "Ви офлайн — редагування профілю тимчасово недоступне",
        ),
      ).not.toBeInTheDocument();
    });

    it("disables save name button when offline", () => {
      useOnlineStatusMock.mockReturnValue(false);
      renderPage();
      const saveBtns = screen.getAllByRole("button", { name: "Зберегти" });
      expect(saveBtns[0]).toBeDisabled();
    });

    it("disables change password button when offline", () => {
      useOnlineStatusMock.mockReturnValue(false);
      renderPage();
      const changeBtn = screen.getByRole("button", {
        name: "Змінити пароль",
      });
      expect(changeBtn).toBeDisabled();
    });

    it("disables delete account button when offline", () => {
      useOnlineStatusMock.mockReturnValue(false);
      renderPage();
      const deleteBtn = screen.getByRole("button", {
        name: "Видалити акаунт",
      });
      expect(deleteBtn).toBeDisabled();
    });

    it("disables avatar upload button when offline", () => {
      useOnlineStatusMock.mockReturnValue(false);
      renderPage();
      const avatarBtns = screen.getAllByLabelText("Змінити аватар");
      expect(avatarBtns[0]).toBeDisabled();
    });
  });

  describe("sessions section", () => {
    it("calls listSessions on mount when online", () => {
      useOnlineStatusMock.mockReturnValue(true);
      renderPage();
      expect(listSessionsMock).toHaveBeenCalled();
    });

    it("does NOT call listSessions when offline", () => {
      useOnlineStatusMock.mockReturnValue(false);
      renderPage();
      expect(listSessionsMock).not.toHaveBeenCalled();
    });

    it("disables refresh button when offline", () => {
      useOnlineStatusMock.mockReturnValue(false);
      renderPage();
      const refreshBtn = screen.getByRole("button", { name: "Оновити" });
      expect(refreshBtn).toBeDisabled();
    });
  });
});
