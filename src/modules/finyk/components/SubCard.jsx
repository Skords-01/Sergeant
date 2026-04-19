import { memo, useState } from "react";
import { daysUntil, fmtDate } from "../utils";
import { cn } from "@shared/lib/cn";
import {
  getLastTxForSubscription,
  getSubscriptionAmountMeta,
} from "../domain/subscriptionUtils.js";

const EMOJI_OPTIONS = [
  "📱",
  "🎵",
  "☁️",
  "▶️",
  "🎬",
  "📧",
  "📸",
  "🤖",
  "🎮",
  "📚",
  "🏋️",
  "💊",
  "🔒",
  "🌐",
  "📡",
];

// Картка підписки. Всередині тримає лише локальний стан редагування,
// тож memo уникає перерендеру при змінах інших підписок/сторінки.
function SubCardComponent({
  sub,
  transactions,
  onDelete,
  onEdit,
  onLinkTransactions,
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: sub.name,
    emoji: sub.emoji,
    keyword: sub.keyword || "",
    billingDay: sub.billingDay,
    currency: sub.currency || "UAH",
  });

  const lastTx = getLastTxForSubscription(sub, transactions);
  const { amount, currency } = getSubscriptionAmountMeta(sub, transactions);
  const days = daysUntil(sub.billingDay);
  const veryClose = days <= 1;
  const soon = days <= 3;

  const saveEdit = () => {
    if (!form.name || !form.billingDay) return;
    onEdit?.({ ...form, billingDay: Number(form.billingDay) });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="bg-panel border border-primary/30 rounded-xl p-4 mb-3 space-y-3">
        <div className="flex gap-2 flex-wrap">
          {EMOJI_OPTIONS.map((e) => (
            <button
              key={e}
              onClick={() => setForm((f) => ({ ...f, emoji: e }))}
              className={cn(
                "text-xl w-9 h-9 rounded-lg flex items-center justify-center transition-colors",
                form.emoji === e
                  ? "bg-emerald-500/15 ring-1 ring-emerald-500/40"
                  : "hover:bg-panelHi",
              )}
            >
              {e}
            </button>
          ))}
        </div>
        <input
          className="w-full bg-bg border border-line rounded-xl px-3 py-2.5 text-sm text-text placeholder:text-subtle outline-none focus:border-primary/50"
          placeholder="Назва"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <input
          className="w-full bg-bg border border-line rounded-xl px-3 py-2.5 text-sm text-text placeholder:text-subtle outline-none focus:border-primary/50"
          placeholder="Ключове слово з транзакції (якщо без ручної привʼязки)"
          value={form.keyword}
          onChange={(e) => setForm((f) => ({ ...f, keyword: e.target.value }))}
        />
        <div className="flex gap-2">
          <input
            className="flex-1 bg-bg border border-line rounded-xl px-3 py-2.5 text-sm text-text outline-none focus:border-primary/50"
            placeholder="День (1-31)"
            type="number"
            min="1"
            max="31"
            value={form.billingDay}
            onChange={(e) =>
              setForm((f) => ({ ...f, billingDay: e.target.value }))
            }
          />
          <select
            className="flex-1 bg-bg border border-line rounded-xl px-3 py-2.5 text-sm text-text outline-none focus:border-primary/50"
            value={form.currency}
            onChange={(e) =>
              setForm((f) => ({ ...f, currency: e.target.value }))
            }
          >
            <option value="UAH">₴ UAH</option>
            <option value="USD">$ USD</option>
            <option value="EUR">€ EUR</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button
            onClick={saveEdit}
            className="flex-1 py-2.5 text-sm font-semibold bg-emerald-500/12 text-emerald-700 border border-emerald-500/25 rounded-xl hover:bg-emerald-500/20 transition-colors"
          >
            Зберегти
          </button>
          <button
            onClick={() => {
              setForm({
                name: sub.name,
                emoji: sub.emoji,
                keyword: sub.keyword || "",
                billingDay: sub.billingDay,
                currency: sub.currency || "UAH",
              });
              setEditing(false);
            }}
            className="flex-1 py-2.5 text-sm font-semibold text-muted border border-line rounded-xl hover:bg-panelHi transition-colors"
          >
            Скасувати
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "bg-panel border rounded-xl p-4 mb-3 flex items-center gap-3",
        veryClose
          ? "border-danger/50"
          : soon
            ? "border-amber-500/40"
            : "border-line",
      )}
    >
      <span className="text-2xl shrink-0 leading-none">{sub.emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate">{sub.name}</div>
        <div
          className={cn(
            "text-xs mt-0.5",
            veryClose ? "text-danger" : soon ? "text-amber-400" : "text-subtle",
          )}
        >
          {veryClose
            ? "⚠️ Завтра"
            : soon
              ? `⏰ Через ${days} дні`
              : `📅 Через ${days} днів`}{" "}
          · {sub.billingDay}-го
        </div>
        {sub.linkedTxId && lastTx && (
          <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
            Привʼязано до транзакції · оновлює суму та дату
          </div>
        )}
        {lastTx && (
          <div className="text-xs text-subtle mt-0.5">
            Останнє: {fmtDate(lastTx.time)}
          </div>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        {amount != null ? (
          <div className="text-sm font-bold">
            {amount.toLocaleString("uk-UA", { maximumFractionDigits: 2 })}
            {currency}
          </div>
        ) : (
          <div className="text-xs text-subtle">ще не списувалось</div>
        )}
        <div className="flex flex-wrap justify-end gap-1.5 mt-1">
          {onLinkTransactions && (
            <button
              type="button"
              onClick={onLinkTransactions}
              className="text-xs font-medium text-primary hover:underline"
            >
              {sub.linkedTxId ? "Змінити транзакцію" : "Привʼязати транзакцію"}
            </button>
          )}
          {onEdit && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-subtle hover:text-primary text-sm transition-colors"
            >
              ✏️
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            className="text-subtle hover:text-danger text-sm transition-colors"
          >
            🗑
          </button>
        </div>
      </div>
    </div>
  );
}

export const SubCard = memo(SubCardComponent);
