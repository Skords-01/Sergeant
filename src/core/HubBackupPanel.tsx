import { useRef, type ChangeEvent } from "react";
import { Button } from "@shared/components/ui/Button";
import { cn } from "@shared/lib/cn";
import { applyHubBackupPayload, buildHubBackupPayload } from "./hubBackup.js";

export interface HubBackupPanelProps {
  className?: string;
}

export function HubBackupPanel({ className }: HubBackupPanelProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);

  const exportJson = () => {
    const payload = buildHubBackupPayload({ includeChat: false });
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `hub-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const runImport = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const input = e.target;
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(String(r.result ?? ""));
        applyHubBackupPayload(data);
        window.location.reload();
      } catch (err) {
        const msg =
          err instanceof Error && err.message
            ? err.message
            : "Не вдалось імпортувати файл";
        alert(msg);
      }
      input.value = "";
    };
    r.readAsText(f);
  };

  return (
    <div
      className={cn(
        "rounded-2xl border border-line/60 bg-panelHi/40 px-3 py-2.5 flex flex-col gap-3 text-xs text-subtle",
        className,
      )}
    >
      <p className="font-semibold text-text leading-snug">
        Резервна копія всього Hub (Фінік, Фізрук, Рутина, останній модуль).
      </p>
      <p className="leading-relaxed text-[11px]">
        Токен Monobank і кеш транзакцій не входять у файл — після імпорту
        підключи рахунок знову в Фініку.
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
          Імпорт…
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={runImport}
        />
      </div>
    </div>
  );
}
