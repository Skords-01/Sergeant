import { useState } from "react";
import { Button } from "@shared/components/ui/Button";
import { PaymentsCalendarBlock } from "../components/PaymentsCalendarBlock";
import { calcCategorySpent } from "../utils";
import { MCC_CATEGORIES } from "../constants";
import { cn } from "@shared/lib/cn";

const formInp = "w-full h-10 rounded-xl border border-line bg-bg px-3 text-sm text-text outline-none focus:border-primary";

export function Budgets({ mono, storage }) {
  const { realTx } = mono;
  const { budgets, setBudgets, excludedTxIds, monthlyPlan, setMonthlyPlan, txCategories, txSplits } = storage;
  const statTx = realTx.filter(t => !excludedTxIds.has(t.id));
  const [editIdx, setEditIdx] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState("limit");
  const [newB, setNewB] = useState({ type: "limit", categoryId: "", limit: "", name: "", emoji: "🎯", targetAmount: "", targetDate: "", savedAmount: "" });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const calcSpent = (budget) => calcCategorySpent(statTx, budget.categoryId, txCategories, txSplits);
  const limitBudgets = budgets.filter(b => b.type === "limit");
  const goalBudgets = budgets.filter(b => b.type === "goal");
  const planIncome = Number(monthlyPlan?.income || 0);
  const planExpense = Number(monthlyPlan?.expense || 0);
  const planSavings = Number(monthlyPlan?.savings || 0);

  const addBudget = () => {
    if (newB.type === "limit" && newB.categoryId && newB.limit) {
      setBudgets(b => [...b, { ...newB, limit: Number(newB.limit), id: Date.now().toString() }]);
      setNewB({ type: "limit", categoryId: "", limit: "", name: "", emoji: "🎯", targetAmount: "", targetDate: "", savedAmount: "" });
      setShowForm(false);
    } else if (newB.type === "goal" && newB.name && newB.targetAmount) {
      setBudgets(b => [...b, { ...newB, targetAmount: Number(newB.targetAmount), savedAmount: Number(newB.savedAmount || 0), id: Date.now().toString() }]);
      setNewB({ type: "limit", categoryId: "", limit: "", name: "", emoji: "🎯", targetAmount: "", targetDate: "", savedAmount: "" });
      setShowForm(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 pt-4 pb-[calc(88px+env(safe-area-inset-bottom,0px))] space-y-3">

        {/* Monthly plan */}
        <div className="bg-panel border border-line rounded-xl p-4">
          <div className="text-[11px] font-bold text-subtle uppercase tracking-widest mb-3">🧭 Фінплан на місяць</div>
          <div className="space-y-2">
            <input className={formInp} type="number" placeholder="План доходу ₴"
              value={monthlyPlan?.income ?? ""} onChange={e => setMonthlyPlan(p => ({ ...(p || {}), income: e.target.value }))} />
            <input className={formInp} type="number" placeholder="План витрат ₴"
              value={monthlyPlan?.expense ?? ""} onChange={e => setMonthlyPlan(p => ({ ...(p || {}), expense: e.target.value }))} />
            <input className={formInp} type="number" placeholder="План накопичень ₴"
              value={monthlyPlan?.savings ?? ""} onChange={e => setMonthlyPlan(p => ({ ...(p || {}), savings: e.target.value }))} />
          </div>
          {(planIncome > 0 || planExpense > 0 || planSavings > 0) && (
            <div className="text-xs text-muted mt-3 pt-3 border-t border-line">
              +{planIncome.toLocaleString("uk-UA")} / −{planExpense.toLocaleString("uk-UA")} / 💰 {planSavings.toLocaleString("uk-UA")} ₴
            </div>
          )}
        </div>

        {/* Limits */}
        <div className="text-[11px] font-bold text-subtle uppercase tracking-widest">🔴 Ліміти · {monthStart.toLocaleDateString("uk-UA", { month: "long" })}</div>
        {limitBudgets.length === 0 && <p className="text-xs text-subtle">Встанови ліміт щоб не виходити за межі</p>}
        {limitBudgets.map((b, i) => {
          const cat = MCC_CATEGORIES.find(c => c.id === b.categoryId);
          const bspent = calcSpent(b);
          const pct = Math.min(100, b.limit > 0 ? Math.round(bspent / b.limit * 100) : 0);
          const over = pct >= 90;
          const globalIdx = budgets.indexOf(b);
          const isEditing = editIdx === globalIdx;
          return (
            <div key={b.id || i} className="bg-panel border border-line rounded-xl p-4">
              {isEditing ? (
                <div className="space-y-2">
                  <input className={formInp} type="number" placeholder="Ліміт ₴" value={b.limit}
                    onChange={e => setBudgets(bs => bs.map((x, j) => j === globalIdx ? { ...x, limit: Number(e.target.value) } : x))} />
                  <div className="flex gap-2">
                    <Button className="flex-1" size="sm" onClick={() => setEditIdx(null)}>Зберегти</Button>
                    <Button className="flex-1" size="sm" variant="danger" onClick={() => { setBudgets(bs => bs.filter((_, j) => j !== globalIdx)); setEditIdx(null); }}>Видалити</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold">{cat?.label || "—"}</span>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-xs", over ? "text-danger" : "text-muted")}>{bspent} / {b.limit} ₴</span>
                      <button onClick={() => setEditIdx(globalIdx)} className="text-subtle hover:text-text text-sm transition-colors">✏️</button>
                    </div>
                  </div>
                  <div className="h-1.5 bg-line rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all duration-500", over ? "bg-danger" : "bg-primary")} style={{ width: `${pct}%` }} />
                  </div>
                  <div className={cn("text-xs mt-1.5", over ? "text-danger" : "text-subtle")}>
                    {over ? `⚠️ ${pct}% — майже вичерпано` : `${pct}% використано`}
                  </div>
                </>
              )}
            </div>
          );
        })}

        {/* Goals */}
        <div className="text-[11px] font-bold text-subtle uppercase tracking-widest pt-1">🟢 Цілі накопичення</div>
        {goalBudgets.length === 0 && <p className="text-xs text-subtle">Постав ціль і відстежуй прогрес</p>}
        {goalBudgets.map((b, i) => {
          const saved = b.savedAmount || 0;
          const pct = Math.min(100, b.targetAmount > 0 ? Math.round(saved / b.targetAmount * 100) : 0);
          const daysLeft = b.targetDate ? Math.ceil((new Date(b.targetDate) - now) / 86400000) : null;
          const globalIdx = budgets.indexOf(b);
          const isEditing = editIdx === globalIdx;
          return (
            <div key={b.id || i} className="bg-panel border border-line rounded-xl p-4">
              {isEditing ? (
                <div className="space-y-2">
                  <input className={formInp} type="number" placeholder="Відкладено ₴" value={b.savedAmount || ""}
                    onChange={e => setBudgets(bs => bs.map((x, j) => j === globalIdx ? { ...x, savedAmount: Number(e.target.value) } : x))} />
                  <div className="flex gap-2">
                    <Button className="flex-1" size="sm" onClick={() => setEditIdx(null)}>Зберегти</Button>
                    <Button className="flex-1" size="sm" variant="danger" onClick={() => { setBudgets(bs => bs.filter((_, j) => j !== globalIdx)); setEditIdx(null); }}>Видалити</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold">{b.emoji} {b.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted">{saved.toLocaleString("uk-UA")} / {b.targetAmount.toLocaleString("uk-UA")} ₴</span>
                      <button onClick={() => setEditIdx(globalIdx)} className="text-subtle hover:text-text text-sm transition-colors">✏️</button>
                    </div>
                  </div>
                  <div className="h-1.5 bg-line rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-success transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-xs text-subtle mt-1.5">
                    {pct}% · {daysLeft !== null ? (daysLeft > 0 ? `${daysLeft} днів до мети` : "⏰ Термін минув!") : "Без дедлайну"}
                  </div>
                </>
              )}
            </div>
          );
        })}

        <PaymentsCalendarBlock mono={mono} storage={storage} />

        {/* Add form */}
        {showForm ? (
          <div className="bg-panel border border-line rounded-xl p-4 space-y-3">
            <div className="flex gap-2">
              <button
                onClick={() => { setFormType("limit"); setNewB(b => ({ ...b, type: "limit" })); }}
                className={cn("flex-1 py-2 text-sm font-semibold rounded-xl border transition-colors", formType === "limit" ? "bg-primary border-primary text-white" : "border-line text-subtle")}
              >🔴 Ліміт</button>
              <button
                onClick={() => { setFormType("goal"); setNewB(b => ({ ...b, type: "goal" })); }}
                className={cn("flex-1 py-2 text-sm font-semibold rounded-xl border transition-colors", formType === "goal" ? "bg-success border-success text-white" : "border-line text-subtle")}
              >🟢 Ціль</button>
            </div>
            {formType === "limit" ? (
              <>
                <select className={formInp} value={newB.categoryId} onChange={e => setNewB(b => ({ ...b, categoryId: e.target.value }))}>
                  <option value="">Вибери категорію</option>
                  {MCC_CATEGORIES.filter(c => c.id !== "income").map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
                <input className={formInp} placeholder="Ліміт ₴" type="number" value={newB.limit} onChange={e => setNewB(b => ({ ...b, limit: e.target.value }))} />
              </>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {["🎯","🏠","🚗","✈️","💻","📱","💍","🎓","🏋️","💰"].map(e => (
                    <button key={e} onClick={() => setNewB(b => ({ ...b, emoji: e }))}
                      className={cn("text-xl p-1.5 rounded-lg border transition-colors", newB.emoji === e ? "border-primary bg-primary/10" : "border-transparent")}>{e}</button>
                  ))}
                </div>
                <input className={formInp} placeholder="Назва цілі" value={newB.name} onChange={e => setNewB(b => ({ ...b, name: e.target.value }))} />
                <input className={formInp} placeholder="Сума цілі ₴" type="number" value={newB.targetAmount} onChange={e => setNewB(b => ({ ...b, targetAmount: e.target.value }))} />
                <input className={formInp} placeholder="Вже відкладено ₴" type="number" value={newB.savedAmount} onChange={e => setNewB(b => ({ ...b, savedAmount: e.target.value }))} />
                <input className={formInp} type="date" value={newB.targetDate} onChange={e => setNewB(b => ({ ...b, targetDate: e.target.value }))} />
              </>
            )}
            <div className="flex gap-2">
              <Button className="flex-1" size="sm" onClick={addBudget}>Додати</Button>
              <Button className="flex-1" size="sm" variant="ghost" onClick={() => setShowForm(false)}>Скасувати</Button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowForm(true)} className="w-full py-3 text-sm text-muted border border-dashed border-line rounded-xl hover:border-primary hover:text-primary transition-colors">
            + Додати бюджет або ціль
          </button>
        )}
      </div>
    </div>
  );
}
