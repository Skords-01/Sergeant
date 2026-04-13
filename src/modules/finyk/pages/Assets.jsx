import { useState } from "react";
import { DebtCard } from "../components/DebtCard";
import { SubCard } from "../components/SubCard";
import { TxRow } from "../components/TxRow";
import { Input } from "@shared/components/ui/Input";
import { Button } from "@shared/components/ui/Button";
import { Select } from "@shared/components/ui/Select";
import { getAccountLabel, getMonoDebt, isMonoDebt, getDebtPaid, getRecvPaid, getMonoTotals } from "../utils";
import { getDebtTxRole, getReceivableTxRole } from "../domain/debtEngine";
import { cn } from "@shared/lib/cn";

function SectionBar({ title, summary, open, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-4 py-3 bg-panelHi border border-line rounded-2xl mb-2 text-left transition-colors hover:border-muted/50"
    >
      <div>
        <div className="text-sm font-bold text-text">{title}</div>
        {summary && <div className="text-xs text-muted mt-0.5">{summary}</div>}
      </div>
      <span className="text-xs text-muted shrink-0 ml-2">{open ? "Згорнути ↑" : "Розкласти ↓"}</span>
    </button>
  );
}

const formInp = "w-full h-11 rounded-2xl border border-line bg-panelHi px-4 text-text outline-none focus:border-muted transition-colors";

export function Assets({ mono, storage, showBalance = true }) {
  const { accounts, transactions } = mono;
  const { hiddenAccounts, manualAssets, setManualAssets, manualDebts, setManualDebts, receivables, setReceivables, toggleLinkedTx, subscriptions, setSubscriptions, monoDebtLinkedTxIds, toggleMonoDebtTx } = storage;

  const [showAssetForm, setShowAssetForm] = useState(false);
  const [showDebtForm, setShowDebtForm] = useState(false);
  const [showRecvForm, setShowRecvForm] = useState(false);
  const [showSubForm, setShowSubForm] = useState(false);
  const [newAsset, setNewAsset] = useState({ name: "", amount: "", currency: "UAH", emoji: "💰" });
  const [newDebt, setNewDebt] = useState({ name: "", emoji: "💸", totalAmount: "", dueDate: "" });
  const [newRecv, setNewRecv] = useState({ name: "", emoji: "👤", amount: "", note: "", dueDate: "" });
  const [newSub, setNewSub] = useState({ name: "", emoji: "📱", keyword: "", billingDay: "", currency: "UAH" });
  const [txPicker, setTxPicker] = useState(null);
  const [open, setOpen] = useState({ subscriptions: false, assets: false, liabilities: false });

  const { balance: monoTotal, debt: monoTotalDebt } = getMonoTotals(accounts, hiddenAccounts);
  const monoDebtAccounts = accounts.filter(a => isMonoDebt(a));
  const manualDebtTotal = manualDebts.reduce((s, d) => s + Math.max(0, d.totalAmount - getDebtPaid(d, transactions)), 0);
  const totalDebt = monoTotalDebt + manualDebtTotal;
  const totalReceivable = receivables.reduce((s, r) => s + Math.max(0, r.amount - getRecvPaid(r, transactions)), 0);
  const manualAssetTotal = manualAssets.filter(a => a.currency === "UAH").reduce((s, a) => s + Number(a.amount), 0);
  const networth = monoTotal + manualAssetTotal + totalReceivable - totalDebt;

  if (txPicker) {
    // --- Mono credit card repayment linking ---
    if (txPicker.type === "monoDebt") {
      const account = accounts.find(a => a.id === txPicker.id);
      const linkedIds = monoDebtLinkedTxIds[txPicker.id] || [];
      const paid = transactions
        .filter(t => linkedIds.includes(t.id))
        .reduce((s, t) => s + Math.abs(t.amount / 100), 0);
      const remaining = getMonoDebt(account);
      const total = paid + remaining;
      const label = getAccountLabel(account);

      const isSuggested = (t) => t._accountId === txPicker.id && t.amount > 0;

      return (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-line bg-bg sticky top-0 z-10">
            <button onClick={() => setTxPicker(null)} className="text-sm text-muted hover:text-text transition-colors">← Назад</button>
            <span className="text-sm font-bold">Погашення: {label}</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto px-4 pt-4 pb-[calc(88px+env(safe-area-inset-bottom,0px))]">
              <div className="bg-panel border border-line rounded-xl p-4 mb-3">
                <div className="text-xs text-subtle mb-1">{label}</div>
                <div className="text-2xl font-extrabold text-danger">−{remaining.toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ₴ залишок боргу</div>
                <div className="text-xs text-subtle mt-1">
                  Погашено цього місяця: {paid.toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ₴ · Базовий борг: {total.toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ₴
                </div>
                <div className="h-1.5 bg-line rounded-full overflow-hidden mt-3">
                  <div className="h-full bg-danger rounded-full transition-all duration-500" style={{ width: `${total > 0 ? Math.min(100, Math.round(paid / total * 100)) : 0}%` }} />
                </div>
              </div>
              <p className="text-xs text-subtle mb-3 px-1">
                Тапни транзакцію щоб прив'язати як погашення. Виділені зеленим — автоматично виявлені поповнення картки.
              </p>
              {transactions.map((t, i) => {
                const isLinked = linkedIds.includes(t.id);
                const suggested = isSuggested(t);
                return (
                  <div key={i}>
                    {suggested && !isLinked && (
                      <div className="text-[10px] font-semibold text-success px-1 pt-1">↑ Поповнення картки</div>
                    )}
                    <TxRow
                      tx={t}
                      highlighted={isLinked}
                      onClick={() => toggleMonoDebtTx(txPicker.id, t.id)}
                      accounts={accounts}
                      hideAmount={!showBalance}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    // --- Manual debt / receivable linking ---
    const isDebt = txPicker.type === "debt";
    const items = isDebt ? manualDebts : receivables;
    const item = items.find(d => d.id === txPicker.id);
    const linked = item?.linkedTxIds || [];
    const paid = isDebt ? getDebtPaid(item, transactions) : getRecvPaid(item, transactions);
    const total = isDebt ? item?.totalAmount : item?.amount;
    const getTxRole = (tx) => (isDebt ? getDebtTxRole(tx) : getReceivableTxRole(tx));

    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-line bg-bg sticky top-0 z-10">
          <button onClick={() => setTxPicker(null)} className="text-sm text-muted hover:text-text transition-colors">← Назад</button>
          <span className="text-sm font-bold">{isDebt ? "Транзакції по пасиву" : "Транзакції по активу"}</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 pt-4 pb-[calc(88px+env(safe-area-inset-bottom,0px))]">
            <div className="bg-panel border border-line rounded-xl p-4 mb-4">
              <div className="text-xs text-subtle">{item?.emoji} {item?.name}</div>
              <div className={cn("text-2xl font-extrabold mt-1", isDebt ? "text-danger" : "text-success")}>
                {isDebt ? "−" : "+"}{Math.max(0, total - paid).toLocaleString("uk-UA")} ₴ залишок
              </div>
              <div className="text-xs text-subtle mt-1">Сплачено: {paid.toLocaleString("uk-UA")} з {total?.toLocaleString("uk-UA")} ₴</div>
            </div>
            {transactions.map((t, i) => {
              const isLinked = linked.includes(t.id);
              const role = isLinked ? getTxRole(t) : null;
              return (
                <div key={i}>
                  {isLinked && (
                    <div className="text-xs font-bold px-1 py-1" style={{ color: role.color }}>{role.label}</div>
                  )}
                  <TxRow tx={t} highlighted={isLinked} onClick={() => toggleLinkedTx(txPicker.id, t.id, txPicker.type)} hideAmount={!showBalance} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 pt-4 pb-[calc(88px+env(safe-area-inset-bottom,0px))] space-y-1">

        {/* Networth */}
        <div className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white rounded-2xl p-5 mb-3 border border-white/10 shadow-float">
          <div className="text-xs text-emerald-100/90 mb-1">Загальний нетворс</div>
          <div className={cn("text-3xl font-extrabold tracking-tight", !showBalance && "tracking-widest")}>
            {showBalance
              ? `${networth.toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ₴`
              : "••••••"}
          </div>
          <div className="text-xs text-emerald-100/85 mt-1">
            {showBalance ? (
              <>
                Активи: {(monoTotal + manualAssetTotal + totalReceivable).toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ₴ · Пасиви: −{totalDebt.toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ₴
              </>
            ) : (
              "Суми приховано"
            )}
          </div>
        </div>

        {/* Subscriptions section */}
        <SectionBar
          title="🔄 Підписки"
          summary={`${subscriptions.length} активних`}
          open={open.subscriptions}
          onToggle={() => setOpen(v => ({ ...v, subscriptions: !v.subscriptions }))}
        />
        {open.subscriptions && (
          <div className="mb-3 space-y-0">
            {subscriptions.map((sub, i) => (
              <SubCard
                key={sub.id}
                sub={sub}
                transactions={transactions}
                onDelete={() => setSubscriptions(ss => ss.filter((_, j) => j !== i))}
                onEdit={updated => setSubscriptions(ss => ss.map((s, j) => j === i ? { ...s, ...updated } : s))}
              />
            ))}
            {showSubForm ? (
              <div className="bg-panel border border-line rounded-xl p-4 space-y-3 mt-2">
                <input className={formInp} placeholder="Назва" value={newSub.name} onChange={e => setNewSub(a => ({ ...a, name: e.target.value }))} />
                <input className={formInp} placeholder="Ключове слово з транзакції" value={newSub.keyword} onChange={e => setNewSub(a => ({ ...a, keyword: e.target.value }))} />
                <input className={formInp} placeholder="День списання (1-31)" type="number" min="1" max="31" value={newSub.billingDay} onChange={e => setNewSub(a => ({ ...a, billingDay: Number(e.target.value) }))} />
                <div className="flex gap-2">
                  <Button className="flex-1" size="sm" onClick={() => { if (newSub.name && newSub.billingDay) { setSubscriptions(ss => [...ss, { ...newSub, id: Date.now().toString() }]); setNewSub({ name: "", emoji: "📱", keyword: "", billingDay: "", currency: "UAH" }); setShowSubForm(false); } }}>Додати</Button>
                  <Button className="flex-1" size="sm" variant="ghost" onClick={() => setShowSubForm(false)}>Скасувати</Button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowSubForm(true)} className="w-full py-2.5 text-sm text-muted border border-dashed border-line rounded-xl hover:border-primary hover:text-primary transition-colors mt-2">+ Додати підписку</button>
            )}
          </div>
        )}

        {/* Assets section */}
        <SectionBar
          title="🟢 Активи"
          summary={`+${(monoTotal + manualAssetTotal + totalReceivable).toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ₴`}
          open={open.assets}
          onToggle={() => setOpen(v => ({ ...v, assets: !v.assets }))}
        />
        {open.assets && (
          <div className="mb-3 space-y-2">
            <div className="text-[11px] font-bold text-subtle uppercase tracking-widest pt-1">💳 Картки Monobank</div>
            {accounts.filter(a => !hiddenAccounts.includes(a.id)).map((a, i) => (
              <div key={i} className="flex items-center justify-between py-2.5 px-1 border-b border-line last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-xl leading-none">💳</span>
                  <div>
                    <div className="text-sm font-medium">{getAccountLabel(a)}</div>
                    <div className="text-xs text-subtle mt-0.5">{(a.balance / 100).toLocaleString("uk-UA", { minimumFractionDigits: 2 })} {a.currencyCode === 980 ? "₴" : a.currencyCode === 840 ? "$" : "€"}</div>
                  </div>
                </div>
              </div>
            ))}

            <div className="text-[11px] font-bold text-subtle uppercase tracking-widest pt-2">💰 Мені винні</div>
            {receivables.map(r => (
              <DebtCard key={r.id} name={r.name} emoji={r.emoji}
                remaining={Math.max(0, r.amount - getRecvPaid(r, transactions))}
                paid={getRecvPaid(r, transactions)} total={r.amount} dueDate={r.dueDate}
                isReceivable onDelete={() => setReceivables(rs => rs.filter(x => x.id !== r.id))}
                onLink={() => setTxPicker({ id: r.id, type: "recv" })} linkedCount={r.linkedTxIds?.length || 0}
              />
            ))}
            {showRecvForm ? (
              <div className="bg-panel border border-line rounded-xl p-4 space-y-3">
                <input className={formInp} placeholder="Ім'я або назва" value={newRecv.name} onChange={e => setNewRecv(a => ({ ...a, name: e.target.value }))} />
                <input className={formInp} placeholder="Сума ₴" type="number" value={newRecv.amount} onChange={e => setNewRecv(a => ({ ...a, amount: e.target.value }))} />
                <input className={formInp} placeholder="Нотатка (необов'язково)" value={newRecv.note} onChange={e => setNewRecv(a => ({ ...a, note: e.target.value }))} />
                <input className={formInp} type="date" value={newRecv.dueDate} onChange={e => setNewRecv(a => ({ ...a, dueDate: e.target.value }))} />
                <div className="flex gap-2">
                  <Button className="flex-1" size="sm" onClick={() => { if (newRecv.name && newRecv.amount) { setReceivables(rs => [...rs, { ...newRecv, id: Date.now().toString(), amount: Number(newRecv.amount), linkedTxIds: [] }]); setNewRecv({ name: "", emoji: "👤", amount: "", note: "", dueDate: "" }); setShowRecvForm(false); } }}>Додати</Button>
                  <Button className="flex-1" size="sm" variant="ghost" onClick={() => setShowRecvForm(false)}>Скасувати</Button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowRecvForm(true)} className="w-full py-2.5 text-sm text-muted border border-dashed border-line rounded-xl hover:border-primary hover:text-primary transition-colors">+ Додати актив "мені винні"</button>
            )}

            <div className="text-[11px] font-bold text-subtle uppercase tracking-widest pt-2">🏦 Інші активи</div>
            {manualAssets.map((a, i) => (
              <div key={i} className="flex items-center justify-between py-2.5 border-b border-[#0f172a]">
                <div className="flex items-center gap-3">
                  <span className="text-xl leading-none">{a.emoji}</span>
                  <div>
                    <div className="text-sm font-medium">{a.name}</div>
                    <div className="text-xs text-subtle">{a.currency}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-success">{Number(a.amount).toLocaleString("uk-UA")} {a.currency === "UAH" ? "₴" : a.currency === "USD" ? "$" : a.currency}</span>
                  <button onClick={() => setManualAssets(as => as.filter((_, j) => j !== i))} className="text-subtle hover:text-danger text-sm transition-colors">🗑</button>
                </div>
              </div>
            ))}
            {showAssetForm ? (
              <div className="bg-panel border border-line rounded-xl p-4 space-y-3">
                <input className={formInp} placeholder="Назва" value={newAsset.name} onChange={e => setNewAsset(a => ({ ...a, name: e.target.value }))} />
                <input className={formInp} placeholder="Сума" type="number" value={newAsset.amount} onChange={e => setNewAsset(a => ({ ...a, amount: e.target.value }))} />
                <select className={formInp} value={newAsset.currency} onChange={e => setNewAsset(a => ({ ...a, currency: e.target.value }))}>
                  <option>UAH</option><option>USD</option><option>EUR</option><option>BTC</option>
                </select>
                <div className="flex gap-2">
                  <Button className="flex-1" size="sm" onClick={() => { if (newAsset.name && newAsset.amount) { setManualAssets(a => [...a, newAsset]); setNewAsset({ name: "", amount: "", currency: "UAH", emoji: "💰" }); setShowAssetForm(false); } }}>Додати</Button>
                  <Button className="flex-1" size="sm" variant="ghost" onClick={() => setShowAssetForm(false)}>Скасувати</Button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowAssetForm(true)} className="w-full py-2.5 text-sm text-muted border border-dashed border-line rounded-xl hover:border-primary hover:text-primary transition-colors">+ Додати актив</button>
            )}
          </div>
        )}

        {/* Liabilities section */}
        <SectionBar
          title="🔴 Пасиви"
          summary={`−${totalDebt.toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ₴`}
          open={open.liabilities}
          onToggle={() => setOpen(v => ({ ...v, liabilities: !v.liabilities }))}
        />
        {open.liabilities && (
          <div className="mb-3 space-y-0">
            {monoDebtAccounts.map((a, i) => {
              const linkedIds = monoDebtLinkedTxIds[a.id] || [];
              const paidFromLinked = transactions
                .filter(t => linkedIds.includes(t.id))
                .reduce((s, t) => s + Math.abs(t.amount / 100), 0);
              const remaining = getMonoDebt(a);
              const volatileTotal = paidFromLinked + remaining;
              return (
                <DebtCard
                  key={i}
                  name={getAccountLabel(a)}
                  emoji="🖤"
                  remaining={remaining}
                  paid={paidFromLinked}
                  total={volatileTotal}
                  onLink={() => setTxPicker({ id: a.id, type: "monoDebt" })}
                  linkedCount={linkedIds.length}
                />
              );
            })}
            {manualDebts.map(d => (
              <DebtCard key={d.id} name={d.name} emoji={d.emoji}
                remaining={Math.max(0, d.totalAmount - getDebtPaid(d, transactions))}
                paid={getDebtPaid(d, transactions)} total={d.totalAmount} dueDate={d.dueDate}
                onDelete={() => setManualDebts(ds => ds.filter(x => x.id !== d.id))}
                onLink={() => setTxPicker({ id: d.id, type: "debt" })}
                linkedCount={d.linkedTxIds?.length || 0}
              />
            ))}
            {showDebtForm ? (
              <div className="bg-panel border border-line rounded-xl p-4 space-y-3">
                <input className={formInp} placeholder="Назва пасиву (кредит, борг...)" value={newDebt.name} onChange={e => setNewDebt(a => ({ ...a, name: e.target.value }))} />
                <input className={formInp} placeholder="Загальна сума ₴" type="number" value={newDebt.totalAmount} onChange={e => setNewDebt(a => ({ ...a, totalAmount: e.target.value }))} />
                <input className={formInp} type="date" value={newDebt.dueDate} onChange={e => setNewDebt(a => ({ ...a, dueDate: e.target.value }))} />
                <div className="flex gap-2">
                  <Button className="flex-1" size="sm" onClick={() => { if (newDebt.name && newDebt.totalAmount) { setManualDebts(ds => [...ds, { ...newDebt, id: Date.now().toString(), totalAmount: Number(newDebt.totalAmount), linkedTxIds: [] }]); setNewDebt({ name: "", emoji: "💸", totalAmount: "", dueDate: "" }); setShowDebtForm(false); } }}>Додати</Button>
                  <Button className="flex-1" size="sm" variant="ghost" onClick={() => setShowDebtForm(false)}>Скасувати</Button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowDebtForm(true)} className="w-full py-2.5 text-sm text-muted border border-dashed border-line rounded-xl hover:border-primary hover:text-primary transition-colors">+ Додати пасив</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
