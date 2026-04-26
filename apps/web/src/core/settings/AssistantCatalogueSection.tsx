import { useNavigate } from "react-router-dom";
import { Button } from "@shared/components/ui/Button";
import { Icon } from "@shared/components/ui/Icon";

/**
 * Settings entry that links to the Assistant capability catalogue
 * (`/assistant`). Surfaces what the chat can do without forcing the user
 * to type `/help` or scroll through chip-strips. The catalogue itself is
 * a full-screen URL-addressable route, so we just render a launcher here.
 */
export function AssistantCatalogueSection() {
  const navigate = useNavigate();
  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold text-text flex items-center gap-2">
        <Icon name="sparkles" size={16} aria-hidden />
        Можливості асистента
      </h3>
      <p className="text-sm text-subtle leading-relaxed">
        ~60 інструментів, які може запустити AI-асистент: фінанси, тренування,
        звички, харчування, аналітика, утиліти, пам&apos;ять. Тапни картку — і
        одразу побачиш приклади команд.
      </p>
      <Button
        variant="secondary"
        size="md"
        onClick={() => navigate("/assistant")}
        className="w-full"
        data-testid="open-assistant-catalogue"
      >
        Відкрити каталог
      </Button>
    </div>
  );
}
