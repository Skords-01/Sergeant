import { useState, useEffect, useId, useMemo } from "react";
import { Button } from "@shared/components/ui/Button";
import { Input } from "@shared/components/ui/Input";
import { Label } from "@shared/components/ui/FormField";
import { SectionHeading } from "@shared/components/ui/SectionHeading";
import { Sheet } from "@shared/components/ui/Sheet";
import { VoiceMicButton } from "@shared/components/ui/VoiceMicButton.jsx";
import { parseExpenseSpeech } from "../../../core/lib/speechParsers.js";
import { useVisualKeyboardInset } from "@shared/hooks/useVisualKeyboardInset";
import { toLocalISODate } from "@shared/lib/date";
import { hapticSuccess } from "@shared/lib/haptic";
import { CANONICAL_TO_MANUAL_LABEL } from "../domain/personalization";

// Manual-expense categories. Labels map to the MCC canonical ids used
// across the rest of Finyk (see `MANUAL_CATEGORY_ID_MAP`), so manual
// entries and bank transactions share one taxonomy for analytics and
// budgets. Emojis mirror the MCC labels for visual consistency.
const CATEGORIES = [
  "🍴 їжа",
  "🛍 продукти",
  "🍔 кафе та ресторани",
  "🚗 транспорт",
  "🎮 розваги",
  "💊 здоров'я",
  "🛍️ покупки",
  "🏠 комунальні",
  "📱 техніка",
  "🎵 підписки",
  "📚 навчання",
  "✈️ подорожі",
  "🏷 інше",
];
const DEFAULT_CATEGORY = "🏷 інше";

// Legacy labels (pre-emoji). Old manual expenses stored category as e.g.
// "їжа". When loaded for edit, we upgrade the string to its emoji
// counterpart so the picker highlights it; saved value still round-trips
// through `MANUAL_CATEGORY_ID_MAP` for personalization/analytics.
const LEGACY_CATEGORY_UPGRADE = {
  їжа: "🍴 їжа",
  транспорт: "🚗 транспорт",
  розваги: "🎮 розваги",
  "здоров'я": "💊 здоров'я",
  одяг: "🛍️ покупки",
  комунальні: "🏠 комунальні",
  техніка: "📱 техніка",
  інше: "🏷 інше",
};

function upgradeCategory(raw) {
  if (!raw) return DEFAULT_CATEGORY;
  if (CATEGORIES.includes(raw)) return raw;
  const up = LEGACY_CATEGORY_UPGRADE[raw];
  return up || raw;
}

// Strips leading emoji + space so "🍴 їжа" → "їжа", used as a human-readable
// fallback description when the user leaves the name empty. We accept any
// run of non-letter / non-digit grapheme chunks so compound emoji (zwj
// sequences, variation selectors) all get peeled off.
function stripEmoji(label) {
  const str = String(label || "");
  let i = 0;
  while (i < str.length && !/[\p{L}\p{N}]/u.test(str[i])) i++;
  return str.slice(i).trim();
}

// Amount suggestion pills. Defaults give a first-run user sane round
// values; once the user has spending history we show personalised
// «Часте» amounts (from top merchants’ average spend) separately
// from the «Швидко» round-number defaults, so the user can tell
// which suggestion is based on their own history and which is a
// generic shortcut.
const DEFAULT_AMOUNTS = [50, 100, 200, 500];

function buildAmountSuggestions(frequentMerchants) {
  const frequent = [];
  for (const m of frequentMerchants || []) {
    if (!m || typeof m.total !== "number" || !m.count) continue;
    const avg = Math.round(m.total / m.count);
    if (avg > 0 && !frequent.includes(avg)) frequent.push(avg);
    if (frequent.length >= 3) break;
  }
  const quick = DEFAULT_AMOUNTS.filter((v) => !frequent.includes(v)).slice(
    0,
    4,
  );
  return { frequent, quick };
}

// Сортує доступні підписи категорій за персональною частотою, зберігаючи
// стабільний порядок для категорій без статистики.
function sortCategoriesByFrequency(frequentCategories = []) {
  if (!frequentCategories.length) return CATEGORIES;
  // Перетворюємо частотну статистику на індекс manual-label → rank.
  // Для canonical id беремо відповідний manual-label; для custom / невідомих —
  // використовуємо original manualLabel, якщо він є у списку кнопок.
  const rank = new Map();
  frequentCategories.forEach((cat, idx) => {
    const label =
      cat.manualLabel && CATEGORIES.includes(cat.manualLabel)
        ? cat.manualLabel
        : CANONICAL_TO_MANUAL_LABEL[cat.id];
    if (label && CATEGORIES.includes(label) && !rank.has(label)) {
      rank.set(label, idx);
    }
  });
  const withRank = CATEGORIES.map((c, originalIdx) => ({
    label: c,
    rank: rank.has(c) ? rank.get(c) : Infinity,
    originalIdx,
  }));
  withRank.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return a.originalIdx - b.originalIdx;
  });
  return withRank.map((x) => x.label);
}

export function ManualExpenseSheet({
  open,
  onClose,
  onSave,
  initialExpense,
  frequentCategories = [],
  frequentMerchants = [],
  initialCategory,
  initialDescription,
}) {
  const formId = useId();
  const descId = `${formId}-desc`;
  const amountId = `${formId}-amount`;
  const dateId = `${formId}-date`;
  const catLabelId = `${formId}-cat-label`;
  const kbInsetPx = useVisualKeyboardInset(open);
  const isEditing = !!initialExpense?.id;
  const [form, setForm] = useState<{
    description: string;
    amount: string;
    category: string;
    date: string;
    showDateField?: boolean;
  }>({
    description: "",
    amount: "",
    category: DEFAULT_CATEGORY,
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
          category: upgradeCategory(initialExpense.category),
          date: toLocalISODate(d),
        });
      } else {
        // Пріоритет: явна initialCategory (клік з дашборду) > найчастіша
        // категорія з статистики > дефолт ("інше"). Будь-яка legacy
        // мітка ("їжа", "транспорт") оновлюється до emoji-версії.
        let startCategory = DEFAULT_CATEGORY;
        if (initialCategory) {
          startCategory = upgradeCategory(initialCategory);
        } else if (frequentCategories.length > 0) {
          const top = frequentCategories[0];
          const topLabel =
            top.manualLabel && typeof top.manualLabel === "string"
              ? upgradeCategory(top.manualLabel)
              : CANONICAL_TO_MANUAL_LABEL[top.id]
                ? upgradeCategory(CANONICAL_TO_MANUAL_LABEL[top.id])
                : null;
          if (topLabel && CATEGORIES.includes(topLabel)) {
            startCategory = topLabel;
          }
        }
        setForm({
          description:
            typeof initialDescription === "string" ? initialDescription : "",
          amount: "",
          category: startCategory,
          date: toLocalISODate(),
        });
      }
      setError("");
    }
    // frequentCategories/initialCategory/initialDescription лише задають
    // стартовий стан при відкритті — навмисно не реагуємо на їхні
    // оновлення у відкритому sheet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialExpense]);

  const sortedCategories = useMemo(
    () => sortCategoriesByFrequency(frequentCategories),
    [frequentCategories],
  );

  const { frequent: frequentAmounts, quick: quickAmounts } = useMemo(
    () => buildAmountSuggestions(frequentMerchants),
    [frequentMerchants],
  );
  // Ховаємо зі списку пропозицій мерчанта, якого вже введено у полі description.
  const merchantSuggestions = useMemo(() => {
    if (!frequentMerchants.length) return [];
    const currentKey = (form.description || "")
      .trim()
      .toLocaleLowerCase("uk-UA");
    return frequentMerchants
      .filter((m) => m.name && m.name.toLocaleLowerCase("uk-UA") !== currentKey)
      .slice(0, 5);
  }, [frequentMerchants, form.description]);

  if (!open) return null;

  const handleSubmit = () => {
    const amt = parseFloat(form.amount);
    if (!form.amount || isNaN(amt) || amt <= 0) {
      setError("Вкажіть суму більше 0");
      return;
    }
    // Description is now optional: if empty we fall back to the category
    // label (without the emoji prefix) so the ledger still has a
    // human-readable line. Keeps the 5-second-add promise while staying
    // searchable.
    const trimmedDesc = form.description.trim();
    const description = trimmedDesc || stripEmoji(form.category);
    hapticSuccess();
    onSave?.({
      ...(initialExpense?.id ? { id: String(initialExpense.id) } : {}),
      description,
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
    <Sheet
      open={open}
      onClose={onClose}
      title={isEditing ? "Редагувати витрату" : "Додати витрату"}
      kbInsetPx={kbInsetPx}
      panelClassName="finyk-sheet"
      bodyClassName="space-y-4"
      footer={
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            Скасувати
          </Button>
          <Button className="flex-1" onClick={handleSubmit}>
            {isEditing ? "Зберегти" : "Додати"}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {/* S15: amount is the only «must-fill» field — it used to live
            under the name input, so new users had to scroll past an
            optional field before they could do the single thing that
            makes an expense valid. Amount is now the first block on the
            sheet; the mic stays near it because dictation typically
            produces both the amount and the description in one shot. */}
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Label htmlFor={amountId}>Сума ₴</Label>
            {(frequentAmounts.length > 0 || quickAmounts.length > 0) && (
              <div className="space-y-1.5 mb-2">
                {frequentAmounts.length > 0 && (
                  <div
                    className="flex flex-wrap items-center gap-1.5"
                    role="group"
                    aria-label="Часті суми"
                  >
                    <SectionHeading as="span" size="xs" tone="subtle">
                      Часте
                    </SectionHeading>
                    {frequentAmounts.map((v) => (
                      <button
                        key={`f-${v}`}
                        type="button"
                        onClick={() =>
                          setForm((f) => ({ ...f, amount: String(v) }))
                        }
                        className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 hover:bg-emerald-500/15 transition-colors tabular-nums"
                      >
                        {v.toLocaleString("uk-UA")} ₴
                      </button>
                    ))}
                  </div>
                )}
                {quickAmounts.length > 0 && (
                  <div
                    className="flex flex-wrap items-center gap-1.5"
                    role="group"
                    aria-label="Швидкі суми"
                  >
                    <SectionHeading as="span" size="xs" tone="subtle">
                      Швидко
                    </SectionHeading>
                    {quickAmounts.map((v) => (
                      <button
                        key={`q-${v}`}
                        type="button"
                        onClick={() =>
                          setForm((f) => ({ ...f, amount: String(v) }))
                        }
                        className="px-2.5 py-1 rounded-full text-xs font-medium bg-panelHi text-muted border border-line hover:border-muted/50 transition-colors tabular-nums"
                      >
                        {v.toLocaleString("uk-UA")} ₴
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <Input
              id={amountId}
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
          {/* Mic-only icon was indistinguishable from the rest of the form
              chrome — users didn't realise they could dictate the whole
              expense. Pair the mic with a "Сказати" label so the affordance
              is visible at rest. `VoiceMicButton` hides itself when the
              Web Speech API isn't supported, so we hide the label too in
              that case via `hidden:*`-style absent fallback (the button
              returns null and the flex container collapses to the input
              alone). */}
          <div className="flex flex-col items-center gap-0.5 pb-1">
            <VoiceMicButton
              size="md"
              label="Сказати голосом"
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
            <span className="text-2xs text-subtle select-none" aria-hidden>
              Сказати
            </span>
          </div>
        </div>

        <div>
          <Label htmlFor={descId} optional>
            Назва
          </Label>
          <Input
            id={descId}
            placeholder="Кава, продукти, таксі…"
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
          />
        </div>

        {/* Date is "today" 95%+ of the time — the always-visible picker
            forced a tap out to a native date sheet just to confirm what
            was already true. Collapse behind a chip; reveal only when the
            user explicitly says "not today" or when editing an older
            entry where the date is already not today. */}
        {form.date !== toLocalISODate() || form.showDateField ? (
          <div>
            <Label htmlFor={dateId}>Дата</Label>
            <Input
              id={dateId}
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, showDateField: true }))}
            className="text-xs text-muted hover:text-text underline decoration-dotted underline-offset-2 transition-colors"
          >
            Не сьогодні? Змінити дату
          </button>
        )}

        {merchantSuggestions.length > 0 && (
          <div
            className="flex flex-wrap gap-1.5 -mt-1"
            role="group"
            aria-label="Нещодавні мерчанти"
          >
            <SectionHeading
              as="span"
              size="xs"
              tone="subtle"
              className="w-full"
            >
              Нещодавнє
            </SectionHeading>
            {merchantSuggestions.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() =>
                  setForm((f) => {
                    const next = { ...f, description: m.name };
                    // Якщо є впевнений підпис manual-категорії для цього
                    // мерчанта — підставляємо його, щоб економити тапи.
                    const suggested =
                      m.suggestedManualCategory &&
                      CATEGORIES.includes(m.suggestedManualCategory)
                        ? m.suggestedManualCategory
                        : null;
                    if (suggested) next.category = suggested;
                    return next;
                  })
                }
                className="px-2.5 py-1 rounded-full text-xs font-medium bg-panelHi text-muted border border-line hover:border-muted/50 transition-colors"
                title={`${m.count} разів · ${m.total.toLocaleString("uk-UA")} ₴`}
              >
                {m.name}
              </button>
            ))}
          </div>
        )}

        <div>
          <div
            id={catLabelId}
            // eslint-disable-next-line sergeant-design/no-eyebrow-drift -- Category group label needs a stable id (catLabelId) for aria-labelledby; Label would require dropping htmlFor.
            className="block text-xs text-muted uppercase tracking-wide font-semibold mb-1"
          >
            Категорія
          </div>
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-labelledby={catLabelId}
          >
            {sortedCategories.map((cat) => (
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

        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    </Sheet>
  );
}
