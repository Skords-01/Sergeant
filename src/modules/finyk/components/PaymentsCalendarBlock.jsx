import { getDebtPaid, getRecvPaid } from "../utils";
import { cn } from "../lib/cn";

const parseLocalDate = (isoDate) => {
  const [y, m, d] = (isoDate || "").split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

const getNextBillingDate = (billingDay, now) => {
  const y = now.getFullYear();
  const m = now.getMonth();
  let date = new Date(y, m, Math.min(billingDay, new Date(y, m + 1, 0).getDate()));
  if (date < new Date(y, m, now.getDate())) {
    date = new Date(y, m + 1, Math.min(billingDay, new Date(y, m + 2, 0).getDate()));
  }
  return date;
};

const dayStart = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export function PaymentsCalendarBlock({ mono, storage }) {
  const { transactions } = mono;
  const { subscriptions, manualDebts, receivables } = storage;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const monthDays = monthEnd.getDate();

  const subEvents = subscriptions.map(sub => {
    const d = getNextBillingDate(sub.billingDay, now);
    const lastTx = transactions.find(t => t.amount < 0 && sub.keyword && (t.description || "").toLowerCase().includes(sub.keyword.toLowerCase()));
    return { id: `sub-${sub.id}`, date: d, day: d.getDate(), title: `${sub.emoji} ${sub.name}`, amount: lastTx ? Math.abs(lastTx.amount / 100) : null, sign: "-", color: "danger" };
  });

  const debtEvents = manualDebts
    .map(d => ({ ...d, remaining: Math.max(0, d.totalAmount - getDebtPaid(d, transactions)) }))
    .filter(d => d.dueDate && d.remaining > 0)
    .map(d => {
      const date = parseLocalDate(d.dueDate);
      return { id: `debt-${d.id}`, date, day: date.getDate(), title: `${d.emoji || "💸"} ${d.name}`, amount: d.remaining, sign: "-", color: "danger" };
    });

  const recvEvents = receivables
    .map(r => ({ ...r, remaining: Math.max(0, r.amount - getRecvPaid(r, transactions)) }))
    .filter(r => r.dueDate && r.remaining > 0)
    .map(r => {
      const date = parseLocalDate(r.dueDate);
      return { id: `recv-${r.id}`, date, day: date.getDate(), title: `${r.emoji || "💰"} ${r.name}`, amount: r.remaining, sign: "+", color: "success" };
    });

  const events = [...subEvents, ...debtEvents, ...recvEvents]
    .filter(e => e.date >= monthStart && e.date <= monthEnd)
    .sort((a, b) => a.date - b.date);

  const eventsByDay = new Map();
  for (const e of events) {
    if (!eventsByDay.has(e.day)) eventsByDay.set(e.day, []);
    eventsByDay.get(e.day).push(e);
  }

  const days = Array.from({ length: monthDays }, (_, i) => i + 1);
  const totalOut = events.filter(e => e.sign === "-" && e.amount).reduce((s, e) => s + e.amount, 0);
  const totalIn = events.filter(e => e.sign === "+" && e.amount).reduce((s, e) => s + e.amount, 0);

  const firstDow = (monthStart.getDay() + 6) % 7;

  return (
    <div className="space-y-3">
      <div className="text-[11px] font-bold text-subtle uppercase tracking-widest">Календар оплат</div>

      <div className="bg-panel border border-line rounded-xl p-4">
        <div className="text-xs text-subtle mb-2">Підсумок · {now.toLocaleDateString("uk-UA", { month: "long", year: "numeric" })}</div>
        <div className="flex gap-4">
          <div className="text-sm font-bold text-danger">−{totalOut.toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ₴</div>
          <div className="text-sm font-bold text-success">+{totalIn.toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ₴</div>
        </div>
      </div>

      <div className="bg-panel border border-line rounded-xl p-3">
        <div className="grid grid-cols-7 gap-1 mb-1">
          {["Пн","Вт","Ср","Чт","Пт","Сб","Нд"].map(d => (
            <div key={d} className="text-center text-[10px] text-subtle py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDow }).map((_, i) => <div key={`e-${i}`} />)}
          {days.map(day => {
            const list = eventsByDay.get(day) || [];
            const isToday = day === now.getDate();
            const hasDanger = list.some(e => e.color === "danger");
            const hasSuccess = list.some(e => e.color === "success");
            return (
              <div
                key={day}
                className={cn(
                  "min-h-[48px] rounded-lg border p-1.5 text-center",
                  isToday ? "border-primary bg-primary/10" : list.length > 0 ? "border-line bg-panelHi" : "border-transparent"
                )}
              >
                <div className={cn("text-xs font-semibold", isToday ? "text-primary" : "text-muted")}>{day}</div>
                {list.length > 0 && (
                  <div className="flex justify-center gap-0.5 mt-1 flex-wrap">
                    {hasDanger && <span className="w-1.5 h-1.5 rounded-full bg-danger inline-block" />}
                    {hasSuccess && <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-[11px] font-bold text-subtle uppercase tracking-widest">Найближчі події</div>
      {events.length === 0 && <p className="text-xs text-subtle">Немає подій на цей місяць</p>}
      {events.filter(e => e.date >= dayStart(now)).slice(0, 20).map(e => (
        <div key={e.id} className="flex items-center justify-between py-3 border-b border-line">
          <div className="min-w-0 mr-2">
            <div className="text-sm font-medium truncate">{e.title}</div>
            <div className="text-xs text-subtle mt-0.5">{e.date.toLocaleDateString("uk-UA", { day: "2-digit", month: "short" })}</div>
          </div>
          <div className={cn("text-sm font-bold tabular-nums shrink-0", e.color === "success" ? "text-success" : "text-danger")}>
            {e.amount ? `${e.sign}${e.amount.toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ₴` : `${e.sign}?`}
          </div>
        </div>
      ))}
    </div>
  );
}
