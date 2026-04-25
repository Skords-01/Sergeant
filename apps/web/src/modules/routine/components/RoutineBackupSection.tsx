import { downloadJson } from "@sergeant/shared";
import { SectionHeading } from "@shared/components/ui/SectionHeading";
import { Button } from "@shared/components/ui/Button";
import { Card } from "@shared/components/ui/Card";
import { cn } from "@shared/lib/cn";
import { buildRoutineBackupPayload } from "../lib/routineStorage";

export interface RoutineBackupTheme {
  primary?: string;
}

export interface RoutineBackupSectionProps {
  theme?: RoutineBackupTheme;
}

export function RoutineBackupSection({ theme }: RoutineBackupSectionProps) {
  return (
    <Card as="section" radius="lg" padding="md" className="space-y-3">
      <SectionHeading as="h2" size="sm">
        Резервна копія
      </SectionHeading>
      <p className="text-xs text-subtle">
        Експорт лише даних Рутини у JSON. Для відновлення або перенесення між
        пристроями використовуй загальний імпорт у «Загальні → Резервна копія».
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className={cn("font-bold", theme?.primary)}
          onClick={async () => {
            await downloadJson(
              `hub-routine-backup-${new Date().toISOString().slice(0, 10)}.json`,
              buildRoutineBackupPayload(),
            );
          }}
        >
          Експорт JSON
        </Button>
      </div>
    </Card>
  );
}
