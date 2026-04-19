import { useRef, useState } from "react";
import { Button } from "@shared/components/ui/Button";
import { ConfirmDialog } from "@shared/components/ui/ConfirmDialog";
import { useToast } from "@shared/hooks/useToast";
import { cn } from "@shared/lib/cn";
import {
  applyFizrukBackupPayload,
  buildFizrukBackupPayload,
} from "../../lib/fizrukStorage";

export function WorkoutBackupBar({ className }) {
  const fileRef = useRef(null);
  const fileReplaceRef = useRef(null);
  const toast = useToast();
  const [confirmReplace, setConfirmReplace] = useState(false);

  const exportJson = () => {
    const payload = buildFizrukBackupPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `fizruk-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const runImport = (e, replace) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(String(r.result));
        applyFizrukBackupPayload(data, { replace });
        window.location.reload();
      } catch (err) {
        toast.error((err as Error)?.message || "Не вдалось імпортувати файл");
      }
      e.target.value = "";
    };
    r.readAsText(f);
  };

  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-panelHi/40 px-3 py-2.5 flex flex-col gap-3 text-xs text-subtle",
        className,
      )}
    >
      <p className="font-semibold text-text leading-snug">
        Резервна копія та імпорт даних Фізрука (тренування, вправи, журнал).
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-9 min-h-[44px]"
          type="button"
          onClick={exportJson}
        >
          Експорт JSON
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 min-h-[44px]"
          type="button"
          onClick={() => fileRef.current?.click()}
        >
          Імпорт (додати)
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 min-h-[44px] text-warning"
          type="button"
          onClick={() => setConfirmReplace(true)}
        >
          Імпорт (замінити)
        </Button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => runImport(e, false)}
      />
      <input
        ref={fileReplaceRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => runImport(e, true)}
      />
      <ConfirmDialog
        open={confirmReplace}
        title="Замінити всі дані Фізрука?"
        description="Поточні тренування та власні вправи буде замінено даними з файлу. Цю дію неможливо відмінити."
        confirmLabel="Замінити"
        cancelLabel="Скасувати"
        danger
        onConfirm={() => {
          setConfirmReplace(false);
          fileReplaceRef.current?.click();
        }}
        onCancel={() => setConfirmReplace(false)}
      />
    </div>
  );
}
