import { cn } from "@shared/lib/cn";
import { Card } from "@shared/components/ui/Card";
import { Button } from "@shared/components/ui/Button";
import { Icon } from "@shared/components/ui/Icon";
import { SectionHeading } from "@shared/components/ui/SectionHeading";

interface CoachInsightCardProps {
  insight: string | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onOpenChat?: (context?: string) => void;
}

export function CoachInsightCard({
  insight,
  loading,
  error,
  onRefresh,
  onOpenChat,
}: CoachInsightCardProps) {
  const handleDiscuss = () => {
    if (typeof onOpenChat === "function") {
      const coachContext = insight
        ? `[Коуч-контекст]\nПерсональне повідомлення дня:\n"${insight}"\n\nЯ хочу обговорити цей інсайт або отримати більше порад.`
        : "[Коуч-контекст]\nЯ хочу поговорити з персональним коучем.";
      onOpenChat(coachContext);
    }
  };

  return (
    <Card
      variant="default"
      radius="lg"
      padding="none"
      className="overflow-hidden"
    >
      <div
        className={cn(
          "px-4 py-3.5 border-l-[4px] border-violet-500",
          "bg-gradient-to-r from-violet-500/[0.06] to-transparent",
          "dark:from-violet-500/[0.10]",
        )}
      >
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-8 h-8 rounded-full bg-violet-500/15 flex items-center justify-center text-sm">
            <span aria-hidden>🤖</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <SectionHeading
                as="span"
                size="xs"
                className="text-violet-600 dark:text-violet-400"
              >
                Коуч
              </SectionHeading>
              <Button
                variant="ghost"
                size="xs"
                iconOnly
                onClick={onRefresh}
                disabled={loading}
                aria-label="Оновити повідомлення коуча"
                className={cn(
                  "text-muted hover:text-text -mr-1",
                  loading && "animate-spin",
                )}
              >
                <Icon name="refresh-cw" size={14} />
              </Button>
            </div>

            {loading && !insight && (
              <p className="text-sm text-muted animate-pulse">
                Коуч готує повідомлення…
              </p>
            )}

            {error && !insight && (
              <p className="text-sm text-danger">{error}</p>
            )}

            {insight && (
              <p className="text-sm text-text leading-relaxed">{insight}</p>
            )}

            {!loading && !error && !insight && (
              <p className="text-sm text-muted">Коуч аналізує твої дані…</p>
            )}

            {onOpenChat && (
              <div className="mt-2.5">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleDiscuss}
                  className="font-semibold"
                >
                  <Icon name="message-circle" size={14} />
                  Обговорити
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
