import { useState, useRef, useEffect, useCallback } from "react";
import { useStorage } from "../modules/finyk/hooks/useStorage";
import { useMonobank } from "../modules/finyk/hooks/useMonobank";
import { getCategory, getMonoTotals, getDebtPaid, getTxStatAmount } from "../modules/finyk/utils";
import { cn } from "@shared/lib/cn";

// Читаємо дані Фізрука з localStorage без монтування модуля
function getFizrukContext() {
  try {
    const raw = localStorage.getItem("fizruk_workouts_v1");
    const workouts = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(workouts) || workouts.length === 0) return null;
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentCount = workouts.filter(w => w.startedAt > weekAgo).length;
    const last = [...workouts].sort((a, b) => b.startedAt - a.startedAt)[0];
    const lastDate = last ? new Date(last.startedAt).toLocaleDateString("uk-UA", { day: "numeric", month: "short" }) : "—";
    return `Тренування: останнє — ${lastDate}, за тиждень — ${recentCount} шт.`;
  } catch { return null; }
}

function buildContext(storage, mono) {
  const { budgets, manualDebts, receivables, subscriptions, monthlyPlan, excludedTxIds, txCategories, hiddenAccounts } = storage;
  const { realTx, accounts, transactions, clientInfo, lastUpdated } = mono;
  const parts = [];

  // Дата оновлення даних
  if (lastUpdated) {
    const fmt = new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(lastUpdated);
    parts.push(`Дані станом на: ${fmt}`);
  }

  // Ім'я
  if (clientInfo?.name) parts.push(`Користувач: ${clientInfo.name}`);

  // Баланс і борги (як в Overview)
  if (accounts?.length > 0) {
    const { balance, debt: monoDebt } = getMonoTotals(accounts, hiddenAccounts || []);
    const manualDebtTotal = manualDebts.reduce((s, d) => s + Math.max(0, d.totalAmount - getDebtPaid(d, transactions || [])), 0);
    const totalDebt = monoDebt + manualDebtTotal;
    parts.push(`На картках: ${balance.toFixed(0)}₴, загальний борг: ${totalDebt.toFixed(0)}₴ (кредитки ${monoDebt.toFixed(0)}₴ + ручні ${manualDebtTotal.toFixed(0)}₴)`);
  }

  // Витрати і дохід місяця
  if (realTx?.length > 0) {
    const statTx = realTx.filter(t => !excludedTxIds?.has(t.id));
    const spent = statTx.filter(t => t.amount < 0).reduce((s, t) => s + getTxStatAmount(t, storage.txSplits), 0);
    const income = statTx.filter(t => t.amount > 0).reduce((s, t) => s + t.amount / 100, 0);
    parts.push(`Витрати місяця: ${spent.toFixed(0)}₴, дохід: ${income.toFixed(0)}₴`);

    // Топ категорій
    const catMap = {};
    statTx.filter(t => t.amount < 0).forEach(t => {
      const cat = getCategory(t.description, t.mcc, txCategories?.[t.id])?.label || "Інше";
      catMap[cat] = (catMap[cat] || 0) + getTxStatAmount(t, storage.txSplits);
    });
    const topCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 4)
      .map(([k, v]) => `${k}: ${v.toFixed(0)}₴`).join(", ");
    if (topCats) parts.push(`Топ витрат: ${topCats}`);

    // Останні 5 транзакцій
    const recent = [...statTx].sort((a, b) => (b.time || 0) - (a.time || 0)).slice(0, 5)
      .map(t => `${t.description || "—"}: ${(t.amount / 100).toFixed(0)}₴`).join("; ");
    if (recent) parts.push(`Останні операції: ${recent}`);
  }

  // Ручні борги (деталі)
  const debts = manualDebts.filter(d => d.totalAmount > 0);
  if (debts.length > 0) {
    const debtStr = debts.map(d => {
      const paid = getDebtPaid(d, transactions || []);
      const rem = Math.max(0, d.totalAmount - paid);
      return `${d.name}: залишок ${rem.toFixed(0)}₴`;
    }).join(", ");
    parts.push(`Деталі боргів: ${debtStr}`);
  }

  // Дебіторка
  const recv = receivables.filter(r => r.amount > 0);
  if (recv.length > 0) {
    parts.push(`Мені винні: ${recv.map(r => `${r.name} ${r.amount}₴`).join(", ")}`);
  }

  // Ліміти бюджету
  const limits = budgets.filter(b => b.type === "limit");
  if (limits.length > 0) {
    parts.push(`Ліміти: ${limits.map(b => `${b.categoryId} ${b.limit}₴`).join(", ")}`);
  }

  // Цілі
  const goals = budgets.filter(b => b.type === "goal");
  if (goals.length > 0) {
    parts.push(`Цілі: ${goals.map(b => `${b.name} — ${b.savedAmount || 0}/${b.targetAmount}₴`).join(", ")}`);
  }

  // Фінплан
  if (monthlyPlan?.income || monthlyPlan?.expense) {
    parts.push(`Фінплан: дохід ${monthlyPlan.income || 0}₴/міс, витрати ${monthlyPlan.expense || 0}₴/міс`);
  }

  // Підписки
  if (subscriptions?.length > 0) {
    parts.push(`Підписки: ${subscriptions.map(s => s.name).join(", ")}`);
  }

  // Фізрук
  const fizruk = getFizrukContext();
  if (fizruk) parts.push(fizruk);

  if (parts.length === 0) return "Фінансових даних немає. Користувач ще не підключив Monobank.";
  return parts.join(". ");
}

const QUICK = [
  "Як справи з бюджетом?",
  "Які борги маю?",
  "Скільки до кінця ліміту?",
  "Порадь щось",
  "Як мої тренування?",
];

// Web Speech API
function useSpeech(onResult) {
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);

  const supported = typeof window !== "undefined" &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const toggle = useCallback(() => {
    if (!supported) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }

    const rec = new SpeechRecognition();
    recRef.current = rec;
    rec.lang = "uk-UA";
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      const text = e.results[0][0].transcript;
      onResult(text);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
    setListening(true);
  }, [listening, onResult, supported]);

  return { listening, toggle, supported };
}

export function HubChat({ onClose }) {
  const storage = useStorage();
  const mono = useMonobank();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (refreshing || mono.loadingTx) return;
    setRefreshing(true);
    try { await mono.refresh(); } finally { setRefreshing(false); }
  };

  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem("hub_chat_history");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [{ role: "assistant", text: "Привіт! Я бачу твої фінанси та тренування. Запитуй — відповім коротко 💬" }];
  });

  // Зберігаємо лише останні 40 повідомлень
  useEffect(() => {
    try {
      localStorage.setItem("hub_chat_history", JSON.stringify(messages.slice(-40)));
    } catch {}
  }, [messages]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const { listening, toggle: toggleMic, supported: speechSupported } = useSpeech((text) => {
    setInput(prev => prev ? `${prev} ${text}` : text);
  });

  const send = async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    const next = [...messages, { role: "user", text: msg }];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const context = buildContext(storage, mono);
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context,
          messages: next.map(m => ({ role: m.role, content: m.text })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setMessages(m => [...m, { role: "assistant", text: data.text || "Немає відповіді." }]);
    } catch (e) {
      setMessages(m => [...m, { role: "assistant", text: `Помилка: ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ paddingTop: "env(safe-area-inset-top,0px)", paddingBottom: "env(safe-area-inset-bottom,0px)" }}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="relative mt-auto flex flex-col bg-bg border-t border-line rounded-t-3xl shadow-float max-h-[92dvh]">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-line rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 shrink-0 border-b border-line/60">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl leading-none">🤖</span>
            <div>
              <div className="text-sm font-semibold text-text">Асистент</div>
              <div className="text-[10px] text-subtle">
                {mono.loadingTx || refreshing
                  ? "Оновлення даних…"
                  : mono.lastUpdated
                  ? `Дані: ${new Intl.DateTimeFormat("uk-UA", { hour: "2-digit", minute: "2-digit" }).format(mono.lastUpdated)}`
                  : "Фінік · Фізрук"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleRefresh}
              disabled={refreshing || mono.loadingTx}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-muted hover:text-primary hover:bg-primary/8 transition-colors disabled:opacity-40"
              title="Оновити дані з Monobank"
            >
              <svg
                width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className={refreshing || mono.loadingTx ? "animate-spin" : ""}
              >
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
            </button>
            <button
              onClick={() => {
                const fresh = [{ role: "assistant", text: "Історію очищено. Чим можу допомогти?" }];
                setMessages(fresh);
                try { localStorage.removeItem("hub_chat_history"); } catch {}
              }}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-muted hover:text-danger hover:bg-danger/8 transition-colors"
              title="Очистити чат"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/>
              </svg>
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-muted hover:text-text hover:bg-panelHi transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={chatRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
          {messages.map((m, i) => (
            <div key={i} className={cn("flex items-end gap-2", m.role === "user" ? "flex-row-reverse" : "flex-row")}>
              {m.role === "assistant" && <span className="text-lg shrink-0 mb-0.5 leading-none">🤖</span>}
              <div className={cn(
                "max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                m.role === "user"
                  ? "bg-primary text-white rounded-br-sm"
                  : "bg-panel border border-line text-text rounded-bl-sm"
              )}>
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-end gap-2">
              <span className="text-lg shrink-0 mb-0.5 leading-none">🤖</span>
              <div className="bg-panel border border-line rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5 items-center">
                {[0, 0.15, 0.3].map((d, i) => (
                  <span key={i} className="w-1.5 h-1.5 bg-subtle rounded-full animate-bounce" style={{ animationDelay: `${d}s` }} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Quick prompts */}
        <div className="flex gap-2 px-4 pt-2 pb-1 overflow-x-auto scrollbar-hide shrink-0">
          {QUICK.map((q, i) => (
            <button
              key={i}
              onClick={() => send(q)}
              className="text-xs px-3 py-1.5 bg-panel border border-line rounded-full text-subtle hover:text-text hover:border-muted whitespace-nowrap transition-colors shrink-0"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="flex gap-2 px-4 pt-2 pb-4 shrink-0">
          <input
            ref={inputRef}
            className="flex-1 bg-panel border border-line rounded-2xl px-4 py-3 text-sm text-text outline-none focus:border-primary/60 placeholder:text-subtle transition-colors"
            placeholder="Запитай про фінанси або тренування..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
          />
          {speechSupported && (
            <button
              onClick={toggleMic}
              className={cn(
                "w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-all border",
                listening
                  ? "bg-danger text-white border-danger animate-pulse"
                  : "bg-panel border-line text-muted hover:text-text hover:border-muted"
              )}
              title={listening ? "Зупинити" : "Голосовий ввід"}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill={listening ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            </button>
          )}
          <button
            onClick={() => send()}
            disabled={loading || !input.trim()}
            className="w-11 h-11 rounded-full bg-primary text-white flex items-center justify-center shrink-0 hover:brightness-110 transition-all disabled:opacity-40"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
