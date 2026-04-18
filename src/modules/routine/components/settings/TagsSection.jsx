import { useRef, useState } from "react";
import { Button } from "@shared/components/ui/Button";
import { Input } from "@shared/components/ui/Input";
import { createTag, deleteTag, updateTag } from "../../lib/routineStorage.js";

export function TagsSection({ routine, setRoutine, tagDraft, setTagDraft }) {
  const [editingTagId, setEditingTagId] = useState(null);
  const [editingTagName, setEditingTagName] = useState("");
  const tagSavedRef = useRef(false);

  const commitEdit = (id) => {
    if (!tagSavedRef.current && editingTagName.trim()) {
      tagSavedRef.current = true;
      setRoutine((s) => updateTag(s, id, editingTagName));
    }
    setEditingTagId(null);
    setEditingTagName("");
  };

  return (
    <section className="bg-panel border border-line/60 rounded-2xl p-4 shadow-card space-y-3">
      <h2 className="text-xs font-bold text-subtle uppercase tracking-widest">
        Теги
      </h2>
      <div className="flex gap-2 items-stretch">
        <Input
          className="routine-touch-field min-w-0 flex-1"
          placeholder="Новий тег"
          value={tagDraft}
          onChange={(e) => setTagDraft(e.target.value)}
        />
        <Button
          type="button"
          variant="ghost"
          className="min-h-[44px] shrink-0 border border-line/70 px-4"
          onClick={() => {
            setRoutine((s) => createTag(s, tagDraft));
            setTagDraft("");
          }}
        >
          +
        </Button>
      </div>
      <ul className="flex flex-wrap gap-2">
        {routine.tags.map((t) => (
          <li
            key={t.id}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-panelHi text-xs border border-line/50 font-medium"
          >
            {editingTagId === t.id ? (
              <form
                className="inline-flex items-center gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  commitEdit(t.id);
                }}
              >
                <Input
                  className="!h-7 !px-1.5 !text-xs w-24"
                  value={editingTagName}
                  onChange={(e) => setEditingTagName(e.target.value)}
                  onBlur={() => commitEdit(t.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      tagSavedRef.current = true;
                      setEditingTagId(null);
                      setEditingTagName("");
                    }
                  }}
                />
              </form>
            ) : (
              <>
                {t.name}
                <button
                  type="button"
                  className="text-subtle hover:text-text min-w-[28px] min-h-[28px] flex items-center justify-center rounded-lg"
                  onClick={() => {
                    tagSavedRef.current = false;
                    setEditingTagId(t.id);
                    setEditingTagName(t.name);
                  }}
                  aria-label={`Змінити ${t.name}`}
                >
                  ✎
                </button>
                <button
                  type="button"
                  className="text-subtle hover:text-danger min-w-[28px] min-h-[28px] flex items-center justify-center rounded-lg"
                  onClick={() => setRoutine((s) => deleteTag(s, t.id))}
                  aria-label={`Видалити ${t.name}`}
                >
                  ×
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
