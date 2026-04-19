// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("../lib/nutritionApi.js", () => ({
  backupUpload: vi.fn(),
  backupDownload: vi.fn(),
}));
vi.mock("../domain/nutritionBackup.js", () => ({
  buildNutritionBackupPayload: vi.fn(() => ({
    version: 1,
    log: { "2025-01-01": { meals: [] } },
  })),
  applyNutritionBackupPayload: vi.fn(),
}));
vi.mock("../lib/nutritionCloudBackup.js", () => ({
  encryptJsonToBlob: vi.fn(() => Promise.resolve("ENC_BLOB")),
  decryptBlobToJson: vi.fn(() => Promise.resolve({ version: 1, log: {} })),
}));

import { useNutritionCloudBackup } from "./useNutritionCloudBackup.js";
import {
  backupUpload as apiBackupUpload,
  backupDownload as apiBackupDownload,
} from "../lib/nutritionApi.js";
import {
  encryptJsonToBlob,
  decryptBlobToJson,
} from "../lib/nutritionCloudBackup.js";

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

function renderHarness(initial = {}) {
  const toast = { success: vi.fn(), error: vi.fn() };
  const setErr = vi.fn();
  const setCloudBackupBusy = vi.fn();
  const setBackupPasswordDialog = vi.fn();
  const setRestoreConfirm = vi.fn();
  const { result } = renderHook(
    () =>
      useNutritionCloudBackup({
        toast,
        setErr,
        cloudBackupBusy: initial.cloudBackupBusy ?? false,
        setCloudBackupBusy,
        backupPasswordDialog: initial.backupPasswordDialog ?? null,
        setBackupPasswordDialog,
        setRestoreConfirm,
      }),
    { wrapper: makeWrapper() },
  );
  return {
    result,
    toast,
    setErr,
    setCloudBackupBusy,
    setBackupPasswordDialog,
    setRestoreConfirm,
  };
}

describe("useNutritionCloudBackup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("dialog openers", () => {
    it("uploadCloudBackup opens password dialog in 'upload' mode", () => {
      const { result, setBackupPasswordDialog } = renderHarness();
      act(() => {
        result.current.uploadCloudBackup();
      });
      expect(setBackupPasswordDialog).toHaveBeenCalledWith(
        expect.objectContaining({ mode: "upload" }),
      );
    });

    it("downloadCloudBackup opens password dialog in 'download' mode", () => {
      const { result, setBackupPasswordDialog } = renderHarness();
      act(() => {
        result.current.downloadCloudBackup();
      });
      expect(setBackupPasswordDialog).toHaveBeenCalledWith(
        expect.objectContaining({ mode: "download" }),
      );
    });

    it("does not open dialog while a backup is in flight", () => {
      const { result, setBackupPasswordDialog } = renderHarness({
        cloudBackupBusy: true,
      });
      act(() => {
        result.current.uploadCloudBackup();
        result.current.downloadCloudBackup();
      });
      expect(setBackupPasswordDialog).not.toHaveBeenCalled();
    });
  });

  describe("handleBackupPasswordConfirm — upload", () => {
    it("encrypts payload, posts to backup-upload, shows success toast", async () => {
      apiBackupUpload.mockResolvedValueOnce({ ok: true });
      const { result, toast, setBackupPasswordDialog } = renderHarness({
        backupPasswordDialog: { mode: "upload" },
      });

      act(() => {
        result.current.handleBackupPasswordConfirm("s3cret");
      });

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Бекап завантажено.");
      });
      expect(encryptJsonToBlob).toHaveBeenCalledWith(
        expect.objectContaining({ version: 1 }),
        "s3cret",
      );
      expect(apiBackupUpload).toHaveBeenCalledWith({ blob: "ENC_BLOB" });
      // Dialog closed before mutation runs.
      expect(setBackupPasswordDialog).toHaveBeenCalledWith(null);
    });

    it("surfaces upload error via setErr", async () => {
      apiBackupUpload.mockRejectedValueOnce(new Error("Upload 500"));
      const { result, setErr } = renderHarness({
        backupPasswordDialog: { mode: "upload" },
      });
      act(() => {
        result.current.handleBackupPasswordConfirm("s3cret");
      });
      await waitFor(() => {
        expect(setErr).toHaveBeenCalledWith("Upload 500");
      });
    });

    it("no-op if pass is empty", () => {
      const { result } = renderHarness({
        backupPasswordDialog: { mode: "upload" },
      });
      act(() => {
        result.current.handleBackupPasswordConfirm("");
      });
      expect(apiBackupUpload).not.toHaveBeenCalled();
      expect(encryptJsonToBlob).not.toHaveBeenCalled();
    });
  });

  describe("handleBackupPasswordConfirm — download", () => {
    it("fetches blob, decrypts, and stashes payload in restoreConfirm", async () => {
      apiBackupDownload.mockResolvedValueOnce({ blob: "REMOTE_BLOB" });
      const { result, setRestoreConfirm } = renderHarness({
        backupPasswordDialog: { mode: "download" },
      });

      act(() => {
        result.current.handleBackupPasswordConfirm("s3cret");
      });

      await waitFor(() => {
        expect(setRestoreConfirm).toHaveBeenCalledWith({
          payload: { version: 1, log: {} },
        });
      });
      expect(decryptBlobToJson).toHaveBeenCalledWith("REMOTE_BLOB", "s3cret");
    });

    it("surfaces download error via setErr", async () => {
      apiBackupDownload.mockRejectedValueOnce(new Error("Download 404"));
      const { result, setErr } = renderHarness({
        backupPasswordDialog: { mode: "download" },
      });
      act(() => {
        result.current.handleBackupPasswordConfirm("s3cret");
      });
      await waitFor(() => {
        expect(setErr).toHaveBeenCalledWith("Download 404");
      });
    });
  });
});
