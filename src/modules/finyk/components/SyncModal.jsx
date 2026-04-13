import { useState, useEffect } from "react";
import { Button } from "@shared/components/ui/Button";
import { cn } from "@shared/lib/cn";

export function SyncModal({ storage, onClose }) {
  const [url, setUrl] = useState(null);
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== "undefined" && !!navigator.share;

  useEffect(() => {
    try {
      setUrl(storage.generateSyncLink());
    } catch (e) {
      console.error("generateSyncLink error:", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- один раз при відкритті модалки; повний storage щоразу новий об’єкт
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      prompt("Скопіюйте посилання:", url);
    }
  };

  const share = async () => {
    try {
      await navigator.share({
        title: "ФІНІК — синхронізація",
        text: "Відкрийте посилання, щоб синхронізувати дані ФІНІК на цьому пристрої",
        url,
      });
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div
        className="relative w-full bg-panel border-t border-line rounded-t-3xl shadow-soft"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 16px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-line rounded-full" />
        </div>

        <div className="px-5 pb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-lg font-bold">Синхронізація</div>
              <div className="text-sm text-muted mt-0.5">
                Перенести налаштування на інший пристрій
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-panelHi text-muted hover:text-text text-lg transition-colors"
            >
              ✕
            </button>
          </div>

          {/* URL display */}
          {url && (
            <div className="mb-4 p-3 bg-bg border border-line rounded-xl">
              <div className="text-xs text-subtle mb-1">
                Посилання для синхронізації
              </div>
              <div className="text-xs text-muted font-mono break-all leading-relaxed line-clamp-3 select-all">
                {url}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2">
            {canShare && (
              <Button
                className="w-full h-12 text-base gap-2"
                onClick={share}
                disabled={!url}
              >
                <span>📤</span> Поділитися посиланням
              </Button>
            )}
            <Button
              variant="ghost"
              className={cn(
                "w-full h-12 text-base gap-2 transition-all",
                copied && "border-success text-success",
              )}
              onClick={copy}
              disabled={!url}
            >
              <span>{copied ? "✅" : "📋"}</span>
              {copied ? "Скопійовано!" : "Скопіювати посилання"}
            </Button>
          </div>

          {/* Info */}
          <div className="mt-4 rounded-xl bg-bg border border-line p-3">
            <div className="text-xs text-subtle leading-relaxed">
              У посиланні: підписки, борги, активи, бюджети, місячний план,
              категорії та спліти операцій, прив’язки боргів Monobank, історія
              нетворсу. Без прихованих рахунків/транзакцій (вони залежать від
              пристрою).
              <br />
              <span className="text-danger/80">Токен Monobank</span>{" "}
              <span className="text-subtle">
                не передається — ввести треба окремо.
              </span>
            </div>
          </div>

          {/* Backup / Restore */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => {
                storage.exportData();
              }}
              className="flex-1 py-3 text-xs font-semibold text-muted border border-dashed border-line rounded-xl hover:border-muted hover:text-text transition-colors"
            >
              💾 Бекап JSON
            </button>
            <label className="flex-1 py-3 text-xs font-semibold text-muted border border-dashed border-line rounded-xl text-center cursor-pointer hover:border-muted hover:text-text transition-colors">
              📥 Відновити
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  const ok = await storage.importData(f);
                  if (ok) onClose();
                }}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
