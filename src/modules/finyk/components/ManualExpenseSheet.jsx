import { useState, useEffect, useId } from "react";
import { Button } from "@shared/components/ui/Button";
import { VoiceMicButton } from "@shared/components/ui/VoiceMicButton.jsx";
import { parseExpenseSpeech } from "../../../core/lib/speechParsers.js";
import { useVisualKeyboardInset } from "@shared/hooks/useVisualKeyboardInset";
import { toLocalISODate } from "@shared/lib/date";

const CATEGORIES = [
  "їжа",
  "транспорт",
  "розваги",
  "здоров'я",
  "одяг",
  "комунальні",
  "техніка",
  "інше",
];

const formInp =
  "w-full h-11 rounded-2xl border border-line bg-panelHi px-4 text-text outline-none focus:border-muted transition-colors";

export function ManualExpenseSheet({ open, onClose, onSave, initialExpense }) {
  const formId = useId();
  const descId = `${formId}-desc`;
  const amountId = `${formId}-amount`;
  const dateId = `${formId}-date`;
  const catLabelId = `${formId}-cat-label`;
  const kbInsetPx = useVisualKeyboardInset(open);
  const isEditing = !!initialExpense?.id;
  const [form, setForm] = useState({
    description: "",
    amount: "",
    category: "інше",
    date: toLocalISODate(),
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      if (initialExpense?.id) {
        const d = initialExpense.date
          ? new Date(initialExpense.date)
          : new Date();
        setForm({
          description: String(initialExpense.description || ""),
          amount:
            initialExpense.amount != null ? String(initialExpense.amount) : "",
          category: initialExpense.category || "інше",
          date: toLocalISODate(d),
        });
      } else {
        setForm({
          description: "",
          amount: "",
          category: "інше",
          date: toLocalISODate(),
        });
      }
      setError("");
    }
  }, [open, initialExpense]);

  if (!open) return null;

  const handleSubmit = () => {
    const amt = parseFloat(form.amount);
    if (!form.description.trim()) {
      setError("Вкажіть назву витрати");
      return;
    }
    if (!form.amount || isNaN(amt) || amt <= 0) {
      setError("Вкажіть суму більше 0");
      return;
    }
    onSave?.({
      ...(initialExpense?.id ? { id: String(initialExpense.id) } : {}),
      description: form.description.trim(),
      amount: amt,
      category: form.category,
      // "YYYY-MM-DD" як local date може з’їхати при toISOString() в UTC.
      // Ставимо полудень, щоб стабільно зберігати правильний день.
      date: form.date
        ? new Date(`${form.date}T12:00:00`).toISOString()
        : new Date().toISOString(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm motion-safe:animate-fade-in">
      <div
        className="w-full max-w-lg bg-panel rounded-t-3xl p-5 pb-safe-area-bottom space-y-4 animate-slide-up"
        style={{ marginBottom: kbInsetPx }}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-bold text-text">
            {isEditing ? "Редагувати витрату" : "Додати витрату"}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-panelHi flex items-center justify-center text-muted hover:text-text transition-colors"
            aria-label="Закрити"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex gap-2 items-center">
            <div className="flex-1">
              <label
                htmlFor={descId}
                className="text-xs text-muted uppercase tracking-wide font-semibold mb-1 block"
              >
                Назва
              </label>
              <input
                id={descId}
                className={formInp}
                placeholder="Кава, продукти, таксі..."
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
            <div className="mt-5">
              <VoiceMicButton
                size="md"
                label="Голосовий ввід"
                onResult={(transcript) => {
                  const parsed = parseExpenseSpeech(transcript);
                  if (!parsed) return;
                  setForm((f) => ({
                    ...f,
                    description: parsed.name || f.description,
                    amount:
                      parsed.amount != null
                        ? String(Math.round(parsed.amount))
                        : f.amount,
                  }));
                }}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor={amountId}
              className="text-xs text-muted uppercase tracking-wide font-semibold mb-1 block"
            >
              Сума ₴
            </label>
            <input
              id={amountId}
              className={formInp}
              type="number"
              inputMode="decimal"
              placeholder="0"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) =>
                setForm((f) => ({ ...f, amount: e.target.value }))
              }
            />
          </div>

          <div>
            <div
              id={catLabelId}
              className="text-xs text-muted uppercase tracking-wide font-semibold mb-1 block"
            >
              Категорія
            </div>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-labelledby={catLabelId}
            >
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setForm((f) => ({ ...f, category: cat }))}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 ease-smooth active:scale-95 ${
                    form.category === cat
                      ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
                      : "bg-panelHi text-muted border-line hover:border-muted/50 hover:bg-panelHi/80"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor={dateId}
              className="text-xs text-muted uppercase tracking-wide font-semibold mb-1 block"
            >
              Дата
            </label>
            <input
              id={dateId}
              className={formInp}
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="flex gap-3 pt-1">
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            Скасувати
          </Button>
          <Button className="flex-1" onClick={handleSubmit}>
            {isEditing ? "Зберегти" : "Додати"}
          </Button>
        </div>
      </div>
    </div>
  );
}
