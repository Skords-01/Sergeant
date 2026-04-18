import { useCallback } from "react";
import { postJson } from "../lib/nutritionApi.js";
import {
  applyNutritionBackupPayload,
  buildNutritionBackupPayload,
} from "../domain/nutritionBackup.js";
import {
  decryptBlobToJson,
  encryptJsonToBlob,
} from "../lib/nutritionCloudBackup.js";

export function useNutritionCloudBackup({
  toast,
  setErr,
  cloudBackupBusy,
  setCloudBackupBusy,
  backupPasswordDialog,
  setBackupPasswordDialog,
  setRestoreConfirm,
}) {
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

  const handleBackupPasswordConfirm = useCallback(
    async (pass) => {
      const mode = backupPasswordDialog?.mode;
      setBackupPasswordDialog(null);
      if (!pass) return;
      if (mode === "upload") {
        try {
          setCloudBackupBusy(true);
          setErr("");
          const payload = buildNutritionBackupPayload();
          const blob = await encryptJsonToBlob(payload, pass);
          await postJson("/api/nutrition/backup-upload", { blob });
          toast.success("Бекап завантажено.");
        } catch (e) {
          setErr(e?.message || "Не вдалося завантажити бекап");
        } finally {
          setCloudBackupBusy(false);
        }
      } else if (mode === "download") {
        try {
          setCloudBackupBusy(true);
          setErr("");
          const data = await postJson("/api/nutrition/backup-download", {});
          const payload = await decryptBlobToJson(data?.blob, pass);
          setRestoreConfirm({ payload });
        } catch (e) {
          setErr(e?.message || "Не вдалося відновити бекап");
        } finally {
          setCloudBackupBusy(false);
        }
      }
    },
    [
      backupPasswordDialog,
      setBackupPasswordDialog,
      setCloudBackupBusy,
      setErr,
      setRestoreConfirm,
      toast,
    ],
  );

  const applyRestorePayload = useCallback((payload) => {
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
