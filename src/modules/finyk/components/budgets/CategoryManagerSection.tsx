import { memo } from "react";
import { Card } from "@shared/components/ui/Card";
import { Icon } from "@shared/components/ui/Icon";
import { cn } from "@shared/lib/cn";
import { CategoryManager } from "../CategoryManager.jsx";

// Collapsible "custom categories" section placed at the bottom of Budgets
// so its open/close state never shifts the cards above.
function CategoryManagerSectionComponent({
  open,
  onToggle,
  customCategories,
  allCategories,
  onAdd,
  onEdit,
  onRemove,
}) {
  return (
    <Card radius="lg" padding="none" className="overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-text hover:bg-panelHi transition-colors"
      >
        <span>Власні категорії</span>
        <Icon
          name="chevron-down"
          size={16}
          className={cn(
            "transition-transform text-muted",
            open ? "rotate-180" : "",
          )}
        />
      </button>
      {open && (
        <div className="px-5 pb-5">
          <CategoryManager
            customCategories={customCategories}
            allCategories={allCategories}
            onAdd={onAdd}
            onEdit={onEdit}
            onRemove={onRemove}
          />
        </div>
      )}
    </Card>
  );
}

export const CategoryManagerSection = memo(CategoryManagerSectionComponent);
