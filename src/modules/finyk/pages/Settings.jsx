import { useState } from "react";
import { Button } from "@shared/components/ui/Button";
import { SyncModal } from "../components/SyncModal";
import { getAccountLabel } from "../utils";
import { cn } from "@shared/lib/cn";

function Section({ title, children }) {
  return (
    <div className="bg-panel border border-line rounded-2xl overflow-hidden shadow-card">
      <div className="px-5 pt-4 pb-2 border-b border-line">
        <div className="text-xs font-bold text-muted uppercase tracking-widest">{title}</div>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  );
}

function ConfirmModal({ open, title, body, confirmLabel, danger, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="finyk-confirm-title">
      <button type="button" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} aria-label="Закрити" />
      <div className="relative w-full max-w-sm bg-panel border border-line rounded-2xl shadow-soft p-5 z-10">
        <h2 id="finyk-confirm-title" className="text-base font-bold text-text">{title}</h2>
        {body && <p className="text-sm text-muted mt-2">{body}</p>}
        <div className="flex gap-2 mt-5">
          <button
            type="button"
            className="flex-1 py-3 rounded-xl border border-line text-sm font-semibold text-muted hover:bg-panelHi transition-colors"
            onClick={onCancel}
          >
            Скасувати
          </button>
          <button
            type="button"
            className={cn(
              "flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-colors",
              danger ? "bg-danger hover:bg-danger/90" : "bg-emerald-600 hover:bg-emerald-700",
            )}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Settings({ mono, storage, showToast }) {
  const { accounts, token, clientInfo, clearTxCache, disconnect } = mono;
  const { hiddenAccounts, toggleHideAccount, exportData, importData } = storage;

  const [syncOpen, setSyncOpen] = useState(false);
  const [confirmKind, setConfirmKind] = useState(null);

  const uahAccounts = accounts.filter(a => a.currencyCode === 980);

  return (
    <div className="flex-1 overflow-y-auto">
      <ConfirmModal
        open={confirmKind !== null}
        title={confirmKind === "cache" ? "Очистити кеш?" : "Вийти з Monobank?"}
        body={
          confirmKind === "cache"
            ? "Буде видалено збережені транзакції в кеші. Потім дані підтягнуться з Monobank знову."
            : "Токен API буде видалено з цього браузера. Потрібно буде ввести його знову."
        }
        confirmLabel={confirmKind === "cache" ? "Очистити" : "Вийти"}
        danger={confirmKind === "disconnect"}
        onCancel={() => setConfirmKind(null)}
        onConfirm={() => {
          if (confirmKind === "cache") clearTxCache?.();
          if (confirmKind === "disconnect") disconnect?.();
          setConfirmKind(null);
          showToast?.(confirmKind === "cache" ? "Кеш очищено" : "Monobank відключено");
        }}
      />
      {syncOpen && <SyncModal storage={storage} onClose={() => setSyncOpen(false)} />}
      <div className="px-4 pt-4 pb-[calc(88px+env(safe-area-inset-bottom,0px))] space-y-4 max-w-4xl mx-auto">

        <p className="text-xs text-subtle px-1 -mt-1">
          Місячний план, ліміти та календар оплат — у розділі <a href="#/budgets" className="text-primary font-medium underline underline-offset-2">Планування</a>.
        </p>

        {/* Accounts */}
        {uahAccounts.length > 0 && (
          <Section title="💳 Рахунки">
            <p className="text-xs text-subtle -mt-1">
              У статистиці та нетворсі враховуються лише рахунки в UAH; інші валюти не враховані. Сховані рахунки не враховуються у балансі та нетворсі.
            </p>
            <div className="space-y-0 -mx-4">
              {uahAccounts.map(acc => {
                const hidden = hiddenAccounts.includes(acc.id);
                return (
                  <div
                    key={acc.id}
                    className="flex items-center justify-between px-4 py-3 border-b border-line last:border-0"
                  >
                    <div>
                      <div className="text-sm font-medium">{getAccountLabel(acc)}</div>
                      <div className="text-xs text-subtle mt-0.5 tabular-nums">
                        {(acc.balance / 100).toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ₴
                        {acc.creditLimit > 0 && ` · ліміт ${(acc.creditLimit / 100).toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ₴`}
                      </div>
                    </div>
                    <button
                      onClick={() => toggleHideAccount(acc.id)}
                      className={cn(
                        "text-xs px-3 py-1.5 rounded-xl border font-semibold transition-colors",
                        hidden
                          ? "border-subtle/50 text-subtle hover:border-muted hover:text-text"
                          : "border-success/40 text-success hover:border-danger/40 hover:text-danger"
                      )}
                    >
                      {hidden ? "Сховано" : "Видно"}
                    </button>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* Profile */}
        {clientInfo && (
          <Section title="👤 Профіль Monobank">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-panelHi border border-line flex items-center justify-center text-xl">
                {clientInfo.name?.charAt(0) || "?"}
              </div>
              <div>
                <div className="text-sm font-semibold">{clientInfo.name}</div>
                <div className="text-xs text-subtle mt-0.5">{uahAccounts.length} UAH рахунків</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-bg rounded-xl border border-line">
              <span className="text-xs text-subtle font-mono flex-1 truncate">
                {token ? token.slice(0, 8) + "••••••••••••••••••" + token.slice(-4) : "—"}
              </span>
              <button
                onClick={() => navigator.clipboard?.writeText(token).catch(() => {})}
                className="text-xs text-muted hover:text-text transition-colors shrink-0"
              >
                📋 Копіювати
              </button>
            </div>
          </Section>
        )}

        {/* Sync */}
        <Section title="🔗 Синхронізація">
          <p className="text-xs text-subtle -mt-1">Перенести налаштування на інший пристрій через посилання</p>
          <Button variant="ghost" className="w-full h-12" onClick={() => setSyncOpen(true)}>
            📤 Sync між пристроями
          </Button>
        </Section>

        {/* Data */}
        <Section title="💾 Дані">
          <p className="text-xs text-subtle -mt-1">
            Бекап: бюджети, підписки, активи, борги, приховані рахунки/транзакції, місячний план, категорії та спліти операцій, прив’язки боргів Monobank, історія нетворсу.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={exportData} className="h-12">
              💾 Експорт JSON
            </Button>
            <label className={cn(
              "flex items-center justify-center h-12 rounded-2xl border border-line text-sm font-semibold text-muted",
              "cursor-pointer hover:bg-panelHi hover:text-text transition-colors"
            )}>
              📥 Імпорт JSON
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) await importData(f);
                }}
              />
            </label>
          </div>
        </Section>

        {/* Cache */}
        <Section title="🧹 Кеш">
          <p className="text-xs text-subtle -mt-1">
            Якщо Monobank “зріже” частину запитів і список операцій виглядає дивно — можна очистити кеш і оновити знову.
          </p>
          <Button
            variant="ghost"
            className="w-full h-12"
            onClick={() => setConfirmKind("cache")}
          >
            🧹 Очистити кеш транзакцій
          </Button>
        </Section>

        <Section title="🚪 Вихід">
          <p className="text-xs text-subtle -mt-1">Відключити Monobank на цьому пристрої (токен буде видалено з браузера).</p>
          <Button
            variant="danger"
            className="w-full h-12"
            onClick={() => setConfirmKind("disconnect")}
          >
            Вийти з Monobank
          </Button>
        </Section>

        {/* About */}
        <div className="text-center text-xs text-subtle pb-2">
          <div className="text-2xl mb-2">💳</div>
          <div className="font-bold text-muted">ФІНІК</div>
          <div className="mt-1">Персональний фінансист</div>
        </div>
      </div>
    </div>
  );
}
