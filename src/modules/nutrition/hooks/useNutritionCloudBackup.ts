import { useCallback, type Dispatch, type SetStateAction } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  backupUpload as apiBackupUpload,
  backupDownload as apiBackupDownload,
} from "../lib/nutritionApi.js";
import {
  applyNutritionBackupPayload,
  buildNutritionBackupPayload,
} from "../domain/nutritionBackup.js";
import {
  decryptBlobToJson,
  encryptJsonToBlob,
} from "../lib/nutritionCloudBackup.js";
import type {
  BackupPasswordDialogState,
  RestoreConfirmState,
} from "./useNutritionUiState.js";

export interface NutritionToast {
  success: (message: string) => void;
  error?: (message: string) => void;
}

export interface UseNutritionCloudBackupParams {
  toast: NutritionToast;
  setErr: Dispatch<SetStateAction<string>>;
  cloudBackupBusy: boolean;
  setCloudBackupBusy: Dispatch<SetStateAction<boolean>>;
  backupPasswordDialog: BackupPasswordDialogState | null;
  setBackupPasswordDialog: Dispatch<
    SetStateAction<BackupPasswordDialogState | null>
  >;
  setRestoreConfirm: Dispatch<SetStateAction<RestoreConfirmState | null>>;
}

export interface UseNutritionCloudBackupResult {
  uploadCloudBackup: () => void;
  downloadCloudBackup: () => void;
  handleBackupPasswordConfirm: (pass: string) => void;
  applyRestorePayload: (payload: unknown) => void;
}

export function useNutritionCloudBackup({
  toast,
  setErr,
  cloudBackupBusy,
  setCloudBackupBusy,
  backupPasswordDialog,
  setBackupPasswordDialog,
  setRestoreConfirm,
}: UseNutritionCloudBackupParams): UseNutritionCloudBackupResult {
  const uploadCloudBackup = useCallback(() => {
    if (cloudBackupBusy) return;
    setBackupPasswordDialog({
      mode: "upload",
      title: "Пароль для шифрування",
      description: "Введіть пароль для шифрування бекапу (запам'ятайте його):",
    });
  }, [cloudBackupBusy, setBackupPasswordDialog]);

  const downloadCloudBackup = useCallback(() => {
    if (cloudBackupBusy) return;
    setBackupPasswordDialog({
      mode: "download",
      title: "Пароль для розшифрування",
      description: "Введіть пароль для розшифрування бекапу:",
    });
  }, [cloudBackupBusy, setBackupPasswordDialog]);

  const uploadMutation = useMutation({
    mutationFn: async ({ pass }: { pass: string }) => {
      const payload = buildNutritionBackupPayload();
      const blob = await encryptJsonToBlob(payload, pass);
      return apiBackupUpload({ blob });
    },
    onMutate: () => {
      setCloudBackupBusy(true);
      setErr("");
    },
    onSuccess: () => {
      toast.success("Бекап завантажено.");
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error ? err.message : "Не вдалося завантажити бекап";
      setErr(message || "Не вдалося завантажити бекап");
    },
    onSettled: () => {
      setCloudBackupBusy(false);
    },
  });

  const downloadMutation = useMutation({
    mutationFn: async ({ pass }: { pass: string }) => {
      const data = await apiBackupDownload();
      const payload = await decryptBlobToJson(data?.blob, pass);
      return { payload };
    },
    onMutate: () => {
      setCloudBackupBusy(true);
      setErr("");
    },
    onSuccess: ({ payload }: { payload: unknown }) => {
      setRestoreConfirm({ payload });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error ? err.message : "Не вдалося відновити бекап";
      setErr(message || "Не вдалося відновити бекап");
    },
    onSettled: () => {
      setCloudBackupBusy(false);
    },
  });

  const handleBackupPasswordConfirm = useCallback(
    (pass: string) => {
      const mode = backupPasswordDialog?.mode;
      setBackupPasswordDialog(null);
      if (!pass) return;
      if (mode === "upload") {
        uploadMutation.mutate({ pass });
      } else if (mode === "download") {
        downloadMutation.mutate({ pass });
      }
    },
    [
      backupPasswordDialog,
      setBackupPasswordDialog,
      uploadMutation,
      downloadMutation,
    ],
  );

  const applyRestorePayload = useCallback((payload: unknown) => {
    if (!payload) return;
    applyNutritionBackupPayload(payload);
    window.location.reload();
  }, []);

  return {
    uploadCloudBackup,
    downloadCloudBackup,
    handleBackupPasswordConfirm,
    applyRestorePayload,
  };
}
