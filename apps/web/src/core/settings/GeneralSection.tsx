import { useCallback, useState, type ChangeEvent } from "react";
import { cn } from "@shared/lib/cn";
import { Icon } from "@shared/components/ui/Icon";
import { Button } from "@shared/components/ui/Button";
import { useToast } from "@shared/hooks/useToast";
import { resetOnboardingState, type KVStore } from "@sergeant/shared";
import { HubBackupPanel } from "../HubBackupPanel.jsx";
import { swClearCaches, swGetDebugSnapshot, swSetDebug } from "../app/swControl";
import {
  DASHBOARD_MODULE_LABELS,
  loadDashboardOrder,
  resetDashboardOrder,
  saveDashboardOrder,
} from "../HubDashboard.jsx";
import {
  SettingsGroup,
  SettingsSubGroup,
  ToggleRow,
} from "./SettingsPrimitives.jsx";
import { useHubPref } from "./hubPrefs.js";

type ModuleId = keyof typeof DASHBOARD_MODULE_LABELS;

interface ModuleReorderListProps {
  order: ModuleId[];
  onMove: (index: number, direction: -1 | 1) => void;
}

function ModuleReorderList({ order, onMove }: ModuleReorderListProps) {
  return (
    <ul className="rounded-xl border border-line divide-y divide-line/60 overflow-hidden">
      {order.map((id, index) => {
        const isFirst = index === 0;
        const isLast = index === order.length - 1;
        return (
          <li key={id} className="flex items-center gap-2 px-3 py-2 bg-panel">
            <span className="text-xs font-semibold text-muted tabular-nums w-4">
              {index + 1}
            </span>
            <span className="flex-1 text-sm text-text truncate">
              {DASHBOARD_MODULE_LABELS[id]}
            </span>
            <button
              type="button"
              onClick={() => onMove(index, -1)}
              disabled={isFirst}
              aria-label={`Підняти ${DASHBOARD_MODULE_LABELS[id]} вище`}
              className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center",
                "text-muted hover:text-text hover:bg-panelHi transition-colors",
                "disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed",
              )}
            >
              <Icon name="chevron-up" size={16} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={() => onMove(index, 1)}
              disabled={isLast}
              aria-label={`Опустити ${DASHBOARD_MODULE_LABELS[id]} нижче`}
              className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center",
                "text-muted hover:text-text hover:bg-panelHi transition-colors",
                "disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed",
              )}
            >
              <Icon name="chevron-down" size={16} strokeWidth={2.5} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export interface GeneralSectionProps {
  dark: boolean;
  onToggleDark: (event: ChangeEvent<HTMLInputElement>) => void;
  syncing: boolean;
  onSync: () => void;
  onPull: () => void;
  user: unknown;
}

export function GeneralSection({
  dark,
  onToggleDark,
  syncing,
  onSync,
  onPull,
  user,
}: GeneralSectionProps) {
  const [orderReset, setOrderReset] = useState(false);
  const [showCoach, setShowCoach] = useHubPref<boolean>("showCoach", true);
  const [showHints, setShowHints] = useHubPref<boolean>("showHints", true);
  const [order, setOrder] = useState<ModuleId[]>(
    () => loadDashboardOrder() as ModuleId[],
  );
  const toast = useToast();
  const [swBusy, setSwBusy] = useState(false);

  const localStorageStore: KVStore = {
    getString(key) {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    setString(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch {
        /* noop */
      }
    },
    remove(key) {
      try {
        localStorage.removeItem(key);
      } catch {
        /* noop */
      }
    },
  };

  const handleMove = useCallback((index: number, direction: -1 | 1) => {
    setOrder((prev) => {
      const next = prev.slice();
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      saveDashboardOrder(next);
      return next;
    });
  }, []);

  const handleResetOrder = () => {
    resetDashboardOrder();
    setOrder(loadDashboardOrder() as ModuleId[]);
    setOrderReset(true);
    setTimeout(() => setOrderReset(false), 2000);
  };

  return (
    <SettingsGroup title="Загальні" emoji="⚙️">
      <ToggleRow label="Темна тема" checked={dark} onChange={onToggleDark} />
      <SettingsSubGroup title="Дашборд">
        <ToggleRow
          label="Показувати AI-коуч"
          description="Блок з щоденною порадою коуча на головному екрані."
          checked={showCoach !== false}
          onChange={(e) => setShowCoach(e.target.checked)}
        />
        <ToggleRow
          label="Показувати підказки"
          description="Короткі підказки в моменті (без спаму)."
          checked={showHints !== false}
          onChange={(e) => setShowHints(e.target.checked)}
        />
      </SettingsSubGroup>
      <SettingsSubGroup title="Онбординг">
        <p className="text-xs text-subtle leading-snug">
          Перезапуск не видаляє твої дані — лише повертає вітальний екран та
          підказки першого запуску.
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-10 w-full"
          onClick={() => {
            resetOnboardingState(localStorageStore);
            toast.success("Онбординг перезапущено");
            try {
              window.location.assign("/welcome");
            } catch {
              /* noop */
            }
          }}
        >
          Перезапустити онбординг
        </Button>
      </SettingsSubGroup>
      <SettingsSubGroup title="PWA та офлайн">
        <p className="text-xs text-subtle leading-snug">
          Якщо після оновлення щось «застрягло» (стара версія або дивні дані),
          можна скинути кеш Service Worker і перезавантажити застосунок.
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-10 flex-1"
            disabled={swBusy || !("serviceWorker" in navigator)}
            onClick={async () => {
              setSwBusy(true);
              try {
                await swSetDebug(true);
                const snap = await swGetDebugSnapshot();
                // eslint-disable-next-line no-console
                console.log("[sw] snapshot", snap);
                toast.success("SW-діагностика виведена в консоль");
              } catch (err) {
                toast.error("Не вдалося отримати діагностику SW");
                // eslint-disable-next-line no-console
                console.warn("[sw] debug failed", err);
              } finally {
                setSwBusy(false);
              }
            }}
          >
            Діагностика SW
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-10 flex-1"
            disabled={swBusy || !("serviceWorker" in navigator)}
            onClick={async () => {
              setSwBusy(true);
              try {
                const res = await swClearCaches();
                // eslint-disable-next-line no-console
                console.log("[sw] caches cleared", res);
                toast.success("Кеш PWA скинуто. Перезавантажуємо…", 4000);
                setTimeout(() => window.location.reload(), 300);
              } catch (err) {
                toast.error("Не вдалося скинути кеш PWA");
                // eslint-disable-next-line no-console
                console.warn("[sw] clear caches failed", err);
              } finally {
                setSwBusy(false);
              }
            }}
          >
            Скинути кеш PWA
          </Button>
        </div>
      </SettingsSubGroup>
      <SettingsSubGroup title="Упорядкувати модулі">
        <p className="text-xs text-subtle leading-snug">
          Порядок модулів у списку «Сьогодні» на дашборді.
        </p>
        <ModuleReorderList order={order} onMove={handleMove} />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-10 w-full"
          onClick={handleResetOrder}
          disabled={orderReset}
        >
          {orderReset ? "✓ Порядок скинуто" : "Скинути до за промовчання"}
        </Button>
      </SettingsSubGroup>
      {user && (
        <SettingsSubGroup title="Хмарна синхронізація">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-10 flex-1"
              disabled={syncing}
              onClick={onSync}
            >
              {syncing ? "Зберігаємо…" : "Зберегти в хмару"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-10 flex-1"
              disabled={syncing}
              onClick={onPull}
            >
              {syncing ? "Завантаження…" : "Завантажити з хмари"}
            </Button>
          </div>
        </SettingsSubGroup>
      )}
      <SettingsSubGroup title="Резервна копія Hub" defaultOpen>
        <HubBackupPanel className="" />
      </SettingsSubGroup>
    </SettingsGroup>
  );
}
