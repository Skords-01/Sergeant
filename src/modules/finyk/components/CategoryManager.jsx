import { useState } from "react";
import { Button } from "@shared/components/ui/Button";
import { Input } from "@shared/components/ui/Input";
import { ConfirmDialog } from "@shared/components/ui/ConfirmDialog";
import { cn } from "@shared/lib/cn";
import { Card } from "@shared/components/ui/Card";

const PRESET_COLORS = [
  "#10b981",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#f97316",
  "#14b8a6",
  "#6366f1",
  "#64748b",
];

const PRESET_ICONS = [
  "🎯",
  "🏠",
  "🚗",
  "✈️",
  "💻",
  "📱",
  "🎓",
  "💊",
  "🛒",
  "🎮",
  "💅",
  "🏋️",
  "🐾",
  "🌱",
  "🎁",
  "🍕",
  "👗",
  "📚",
  "🔧",
  "💰",
];

function ColorPicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PRESET_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={cn(
            "w-6 h-6 rounded-full border-2 transition-transform",
            value === c ? "border-text scale-110" : "border-transparent",
          )}
          style={{ background: c }}
          aria-label={c}
        />
      ))}
    </div>
  );
}

function IconPicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1">
      {PRESET_ICONS.map((icon) => (
        <button
          key={icon}
          type="button"
          onClick={() => onChange(icon)}
          className={cn(
            "w-8 h-8 text-base rounded-lg border transition-colors",
            value === icon
              ? "border-primary bg-primary/10"
              : "border-transparent hover:bg-panelHi",
          )}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}

function CategoryForm({ initial = {}, allCategories = [], onSave, onCancel }) {
  const [label, setLabel] = useState(initial.label || "");
  const [color, setColor] = useState(initial.color || PRESET_COLORS[0]);
  const [icon, setIcon] = useState(initial.icon || "");
  const [parentId, setParentId] = useState(initial.parentId || "");
  const [error, setError] = useState("");

  const rootCategories = allCategories.filter((c) => !c.parentId);

  const handleSave = () => {
    const trimmed = label.trim();
    if (!trimmed) {
      setError("Введіть назву");
      return;
    }
    if (trimmed.length > 80) {
      setError("Максимум 80 символів");
      return;
    }
    onSave({
      label: trimmed,
      color,
      icon: icon || undefined,
      parentId: parentId || undefined,
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <label
          htmlFor="cat-label-input"
          className="text-xs text-muted mb-1 block"
        >
          Назва
        </label>
        <Input
          id="cat-label-input"
          value={label}
          onChange={(e) => {
            setLabel(e.target.value);
            setError("");
          }}
          placeholder="Назва категорії"
          maxLength={80}
        />
        {error && <p className="text-xs text-danger mt-1">{error}</p>}
      </div>

      <div role="group" aria-labelledby="cat-icon-label">
        <span id="cat-icon-label" className="text-xs text-muted mb-1.5 block">
          Іконка
        </span>
        <IconPicker value={icon} onChange={setIcon} />
      </div>

      <div role="group" aria-labelledby="cat-color-label">
        <span id="cat-color-label" className="text-xs text-muted mb-1.5 block">
          Колір
        </span>
        <ColorPicker value={color} onChange={setColor} />
      </div>

      {rootCategories.length > 0 && (
        <div>
          <label
            htmlFor="cat-parent-select"
            className="text-xs text-muted mb-1 block"
          >
            Підкатегорія до
          </label>
          <select
            id="cat-parent-select"
            className="w-full h-10 rounded-xl border border-line bg-bg px-3 text-sm text-text outline-none focus:border-primary"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
          >
            <option value="">— Коренева категорія</option>
            {rootCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button size="sm" className="flex-1" onClick={handleSave}>
          Зберегти
        </Button>
        <Button size="sm" variant="ghost" className="flex-1" onClick={onCancel}>
          Скасувати
        </Button>
      </div>
    </div>
  );
}

export function CategoryManager({
  customCategories = [],
  allCategories = [],
  onAdd,
  onEdit,
  onRemove,
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const getParentLabel = (parentId) => {
    if (!parentId) return null;
    const p = allCategories.find((c) => c.id === parentId);
    return p?.label || null;
  };

  return (
    <div>
      <div className="text-[11px] font-bold text-subtle uppercase tracking-widest mb-3">
        Власні категорії
      </div>

      {customCategories.length === 0 && !showForm && (
        <p className="text-sm text-muted mb-3">Власних категорій ще немає</p>
      )}

      <div className="space-y-2 mb-3">
        {customCategories.map((cat) => {
          if (editingId === cat.id) {
            return (
              <div
                key={cat.id}
                className="bg-panel border border-primary/40 rounded-2xl p-4 shadow-card"
              >
                <CategoryForm
                  initial={cat}
                  allCategories={customCategories.filter(
                    (c) => c.id !== cat.id,
                  )}
                  onSave={(patch) => {
                    onEdit(cat.id, patch);
                    setEditingId(null);
                  }}
                  onCancel={() => setEditingId(null)}
                />
              </div>
            );
          }

          const parentLabel = getParentLabel(cat.parentId);
          return (
            <div
              key={cat.id}
              className="bg-panel border border-line rounded-2xl px-4 py-3 flex items-center gap-3 shadow-card"
            >
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0"
                style={{ background: cat.color ? `${cat.color}22` : undefined }}
              >
                {cat.icon || (
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ background: cat.color || "#94a3b8" }}
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text truncate">
                  {cat.label}
                </div>
                {parentLabel && (
                  <div className="text-xs text-muted truncate">
                    {parentLabel}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setEditingId(cat.id)}
                className="text-muted hover:text-text transition-colors p-1"
                aria-label="Редагувати"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setDeletingId(cat.id)}
                className="text-muted hover:text-danger transition-colors p-1"
                aria-label="Видалити"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      {showForm ? (
        <Card radius="lg">
          <div className="text-sm font-semibold text-text mb-3">
            Нова категорія
          </div>
          <CategoryForm
            allCategories={customCategories}
            onSave={(data) => {
              onAdd(data.label, {
                color: data.color,
                icon: data.icon,
                parentId: data.parentId,
              });
              setShowForm(false);
            }}
            onCancel={() => setShowForm(false)}
          />
        </Card>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="w-full py-2.5 text-sm text-muted border border-dashed border-line rounded-xl hover:border-primary hover:text-primary transition-colors"
        >
          + Додати категорію
        </button>
      )}

      <ConfirmDialog
        open={!!deletingId}
        title="Видалити категорію?"
        description="Всі транзакції цієї категорії будуть переведені в «Інше»."
        confirmLabel="Видалити"
        onConfirm={() => {
          onRemove(deletingId);
          setDeletingId(null);
        }}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  );
}
