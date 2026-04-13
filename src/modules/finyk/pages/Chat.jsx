import { useState, useRef, useEffect } from "react";
import { MCC_CATEGORIES } from "../constants";
import { getCategory, isMonoDebt, getMonoDebt, getDebtPaid, calcCategorySpent, getMonoTotals } from "../utils";
import { cn } from "@shared/lib/cn";

export function Chat({ mono, storage }) {
  const { realTx, clientInfo, accounts, transactions } = mono;
  const { budgets, manualDebts, receivables, hiddenAccounts, excludedTxIds, txCategories, setBudgets, setManualDebts, setReceivables, hideTx, overrideCategory } = storage;
  const statTx = realTx.filter(t => !excludedTxIds.has(t.id));

  const [messages, setMessages] = useState([{ role: "assistant", text: "Привіт! 👋 Запитай мене про свої фінанси — я бачу твої транзакції, бюджети та борги." }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatRef = useRef(null);

  useEffect(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, [messages]);

  const { balance: monoTotal, debt: monoTotalDebt } = getMonoTotals(accounts, hiddenAccounts);
  const manualDebtTotal = manualDebts.reduce((s, d) => s + Math.max(0, d.totalAmount - getDebtPaid(d, transactions)), 0);
  const totalDebt = monoTotalDebt + manualDebtTotal;
  const spent = statTx.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount / 100), 0);
  const income = statTx.filter(t => t.amount > 0).reduce((s, t) => s + t.amount / 100, 0);

  const bdgStr = budgets.map(b => {
    const cat = MCC_CATEGORIES.find(c => c.id === b.categoryId);
    return b.type === "limit"
      ? `${cat?.label}: ${calcCategorySpent(statTx, b.categoryId)}/${b.limit}₴`
      : `Ціль ${b.name}: ${b.savedAmount || 0}/${b.targetAmount}₴`;
  }).join(", ");

  const topTx = statTx.slice(0, 15).map(t =>
    `[id:${t.id}] ${t.description}(${getCategory(t.description, t.mcc, txCategories[t.id]).label.slice(3)}): ${(t.amount / 100).toFixed(0)}₴`
  ).join("; ");

  const catIds = MCC_CATEGORIES.map(c => `${c.id}="${c.label}"`).join(", ");

  const context = `Ім'я: ${clientInfo?.name}. На картках: ${monoTotal.toFixed(0)}₴. Витрати місяця: ${spent.toFixed(0)}₴. Дохід: ${income.toFixed(0)}₴. Борги: ${totalDebt.toFixed(0)}₴. Бюджети: ${bdgStr || "не налаштовані"}. [Категорії]: ${catIds}. [Останні операції]: ${topTx}.`;

  const executeTool = (name, input) => {
    switch (name) {
      case "change_category":
        overrideCategory(input.tx_id, input.category_id);
        return "Категорію змінено";
      case "hide_transaction":
        hideTx(input.tx_id);
        return "Транзакцію приховано";
      case "create_debt":
        setManualDebts(prev => [...prev, {
          id: Date.now().toString(),
          name: input.name,
          totalAmount: input.amount,
          emoji: input.emoji || "💸",
          dueDate: input.due_date || "",
          linkedTxIds: [],
        }]);
        return "Борг додано";
      case "create_receivable":
        setReceivables(prev => [...prev, {
          id: Date.now().toString(),
          name: input.name,
          amount: input.amount,
          emoji: "📥",
          dueDate: "",
          linkedTxIds: [],
        }]);
        return "Дебіторку додано";
      case "set_budget_limit":
        setBudgets(prev => {
          const exists = prev.some(b => b.type === "limit" && b.categoryId === input.category_id);
          if (exists) return prev.map(b => b.type === "limit" && b.categoryId === input.category_id ? { ...b, limit: input.limit } : b);
          return [...prev, { id: Date.now().toString(), type: "limit", categoryId: input.category_id, limit: input.limit }];
        });
        return "Ліміт встановлено";
      default:
        return "ok";
    }
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    const text = input.trim();
    const nextMessages = [...messages, { role: "user", text }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context,
          messages: nextMessages.map(m => ({ role: m.role, content: m.text })),
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || `HTTP ${res.status}`);
      }
      const data = await res.json();

      // Handle tool_calls from AI
      if (data.tool_calls && data.tool_calls.length > 0) {
        if (data.text) {
          setMessages(m => [...m, { role: "assistant", text: data.text }]);
        }

        // Execute tools and collect results
        const toolResults = data.tool_calls.map(tc => ({
          tool_use_id: tc.id,
          content: executeTool(tc.name, tc.input),
        }));

        // Send results back to get final AI response
        const res2 = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            context,
            messages: nextMessages.map(m => ({ role: m.role, content: m.text })),
            tool_results: toolResults,
            tool_calls_raw: data.tool_calls_raw,
          }),
        });
        if (!res2.ok) {
          const payload2 = await res2.json().catch(() => ({}));
          throw new Error(payload2.error || `HTTP ${res2.status}`);
        }
        const data2 = await res2.json();
        setMessages(m => [...m, { role: "assistant", text: data2.text || "Готово." }]);
      } else {
        setMessages(m => [...m, { role: "assistant", text: data.text || "Помилка." }]);
      }
    } catch (e) {
      setMessages(m => [...m, { role: "assistant", text: `Помилка з'єднання з AI: ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Messages */}
      <div ref={chatRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={cn("flex items-end gap-2", m.role === "user" ? "flex-row-reverse" : "flex-row")}>
            {m.role === "assistant" && <span className="text-xl shrink-0 mb-1 leading-none">🤖</span>}
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                m.role === "user"
                  ? "bg-primary text-white rounded-br-sm"
                  : "bg-panel border border-line text-text rounded-bl-sm"
              )}
            >
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-end gap-2">
            <span className="text-xl shrink-0 mb-1 leading-none">🤖</span>
            <div className="bg-panel border border-line rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5 items-center">
              {[0, 0.15, 0.3].map((d, i) => (
                <span key={i} className="w-1.5 h-1.5 bg-subtle rounded-full inline-block animate-bounce" style={{ animationDelay: `${d}s` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick prompts */}
      <div className="flex gap-2 px-4 py-2 flex-wrap">
        {["Скільки витратив?", "Який борг?", "Де більше витрачаю?", "Дай пораду"].map((q, i) => (
          <button
            key={i}
            onClick={() => setInput(q)}
            className="text-xs px-3 py-1.5 bg-panel border border-line rounded-full text-subtle hover:text-text hover:border-muted transition-colors"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2 px-4 pb-[calc(88px+env(safe-area-inset-bottom,0px))] pt-2">
        <input
          className="flex-1 bg-panel border border-line rounded-2xl px-4 py-3 text-sm text-text outline-none focus:border-primary placeholder:text-subtle"
          placeholder="Запитай про фінанси..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
        />
        <button
          onClick={send}
          className="w-11 h-11 rounded-full bg-primary text-white text-lg flex items-center justify-center shrink-0 hover:brightness-110 transition-all disabled:opacity-50"
          disabled={loading || !input.trim()}
        >
          ↑
        </button>
      </div>
    </div>
  );
}
