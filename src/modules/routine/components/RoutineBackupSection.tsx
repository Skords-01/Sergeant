import { useRef, type ChangeEvent } from "react";
import { SectionHeading } from "@shared/components/ui/SectionHeading";
import { Button } from "@shared/components/ui/Button";
import { Card } from "@shared/components/ui/Card";
import { cn } from "@shared/lib/cn";
import { buildRoutineBackupPayload } from "../lib/routineStorage.js";

export interface RoutineBackupTheme {
  primary?: string;
}

export interface RoutineBackupToast {
  warning?: (message: string) => void;
}

export interface RoutineBackupSectionProps {
  theme?: RoutineBackupTheme;
  toast?: RoutineBackupToast;
  onImportParsed?: (parsed: unknown) => void;
}

export function RoutineBackupSection({
  theme,
  toast,
  onImportParsed,
}: RoutineBackupSectionProps) {
  const backupRef = useRef<HTMLInputElement | null>(null);

  return (
    <Card as="section" radius="lg" padding="md" className="space-y-3">
      <SectionHeading as="h2" size="sm">
        Резервна копія
      </SectionHeading>
      <p className="text-xs text-subtle">
        Експорт/імпорт JSON для переносу даних між пристроями.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className={cn("font-bold", theme?.primary)}
          onClick={() => {
            const blob = new Blob(
              [JSON.stringify(buildRoutineBackupPayload(), null, 2)],
              { type: "application/json" },
            );
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `hub-routine-backup-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 1500);
          }}
        >
          Експорт JSON
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="border border-line"
          onClick={() => backupRef.current?.click()}
        >
          Імпорт
        </Button>
        <input
          ref={backupRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (e: ChangeEvent<HTMLInputElement>) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              const text = await f.text();
              const parsed: unknown = JSON.parse(text);
              onImportParsed?.(parsed);
            } catch (err) {
              const msg =
                err instanceof Error
                  ? err.message
                  : "Не вдалося імпортувати файл.";
              toast?.warning?.(msg);
            }
            e.target.value = "";
          }}
        />
      </div>
    </Card>
  );
}
