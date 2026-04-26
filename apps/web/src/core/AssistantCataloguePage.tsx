import { useMemo, useState } from "react";
import { Button } from "@shared/components/ui/Button";
import { Icon } from "@shared/components/ui/Icon";
import { SectionHeading } from "@shared/components/ui/SectionHeading";
import { cn } from "@shared/lib/cn";
import {
  ASSISTANT_CAPABILITIES,
  CAPABILITY_MODULE_META,
  CAPABILITY_MODULE_ORDER,
  groupCapabilitiesByModule,
  searchCapabilities,
  type AssistantCapability,
  type CapabilityModule,
} from "@sergeant/shared";
import { CapabilityDetailModal } from "./components/CapabilityDetailModal";

interface AssistantCataloguePageProps {
  onClose: () => void;
}

/**
 * Send a chat message via the global `hub:openChat` event. Avoids importing
 * the chat module directly from this page (and the cycle that would create).
 *
 * - `autoSend=true` ⇒ assistant sends the message immediately;
 * - `autoSend=false` ⇒ message is prefilled into the input, waiting for the
 *   user to add details and hit enter.
 */
function dispatchOpenChat(message: string, autoSend: boolean): void {
  window.dispatchEvent(
    new CustomEvent("hub:openChat", { detail: { message, autoSend } }),
  );
}

export function AssistantCataloguePage({
  onClose,
}: AssistantCataloguePageProps) {
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<AssistantCapability | null>(null);

  const filtered = useMemo(
    () => (query.trim() ? searchCapabilities(query) : ASSISTANT_CAPABILITIES),
    [query],
  );
  const groups = useMemo(() => groupCapabilitiesByModule(filtered), [filtered]);

  const handleActivate = (cap: AssistantCapability) => {
    if (cap.requiresInput) {
      setDetail(cap);
      return;
    }
    onClose();
    dispatchOpenChat(cap.prompt, true);
  };

  const handleTryFromDetail = (cap: AssistantCapability) => {
    setDetail(null);
    onClose();
    dispatchOpenChat(cap.prompt, false);
  };

  return (
    <div
      className="min-h-dvh bg-bg"
      style={{
        paddingTop: "max(1.25rem, env(safe-area-inset-top))",
        paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className="max-w-2xl mx-auto px-5 pb-8">
        <div className="flex items-center gap-3 pt-6 pb-3">
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            onClick={onClose}
            aria-label="Назад"
          >
            <Icon name="chevron-left" size={20} />
          </Button>
          <h1 className="text-xl font-bold text-text">Можливості асистента</h1>
        </div>

        <p className="text-sm text-subtle mb-4">
          Усе, що вміє робити асистент. Натисни картку щоб запустити сценарій
          або побачити приклади.
        </p>

        <div className="relative mb-4">
          <span
            aria-hidden
            className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle"
          >
            <Icon name="search" size={16} />
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Пошук — наприклад, «витрата», «звичка», «1RM»…"
            className="w-full bg-panel border border-line rounded-2xl pl-9 pr-3 py-3 text-sm text-text placeholder:text-subtle focus:outline-none focus:border-brand-500/50"
            aria-label="Пошук можливостей"
          />
        </div>

        {filtered.length === 0 && (
          <div className="text-center text-subtle py-12 text-sm">
            Нічого не знайдено за «{query}». Спробуй інший термін.
          </div>
        )}

        <div className="space-y-6">
          {groups.map((g) => (
            <ModuleGroup
              key={g.module}
              module={g.module}
              capabilities={g.capabilities}
              onActivate={handleActivate}
            />
          ))}
        </div>
      </div>

      <CapabilityDetailModal
        capability={detail}
        onClose={() => setDetail(null)}
        onTryInChat={handleTryFromDetail}
      />
    </div>
  );
}

interface ModuleGroupProps {
  module: CapabilityModule;
  capabilities: readonly AssistantCapability[];
  onActivate: (cap: AssistantCapability) => void;
}

function ModuleGroup({ module, capabilities, onActivate }: ModuleGroupProps) {
  const meta = CAPABILITY_MODULE_META[module];
  return (
    <section aria-labelledby={`catalogue-module-${module}`}>
      <SectionHeading
        as="h2"
        size="sm"
        tone="text"
        id={`catalogue-module-${module}`}
        className="flex items-center gap-2 mb-2"
      >
        <Icon name={meta.icon} size={14} aria-hidden />
        {meta.title}
        <span className="text-subtle font-normal normal-case tracking-normal">
          ({capabilities.length})
        </span>
      </SectionHeading>
      <ul className="space-y-2">
        {capabilities.map((cap) => (
          <li key={cap.id}>
            <CapabilityRow capability={cap} onActivate={onActivate} />
          </li>
        ))}
      </ul>
    </section>
  );
}

interface CapabilityRowProps {
  capability: AssistantCapability;
  onActivate: (cap: AssistantCapability) => void;
}

function CapabilityRow({ capability, onActivate }: CapabilityRowProps) {
  return (
    <button
      type="button"
      data-testid={`catalogue-capability-${capability.id}`}
      onClick={() => onActivate(capability)}
      className={cn(
        "w-full text-left bg-panel border border-line rounded-2xl px-4 py-3",
        "hover:border-muted hover:bg-panel/80 transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/45",
        "flex items-start gap-3",
      )}
    >
      <span
        aria-hidden
        className="shrink-0 w-9 h-9 rounded-full bg-bg flex items-center justify-center text-text"
      >
        <Icon name={capability.icon} size={16} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-text">
            {capability.label}
          </span>
          {capability.isQuickAction && (
            <span
              title="Швидкий сценарій (показується chip-ом у чаті)"
              // eslint-disable-next-line sergeant-design/no-eyebrow-drift
              className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-bold text-brand-600 bg-brand-500/10 border border-brand-500/40 rounded-full px-1.5 py-0.5"
            >
              <Icon name="zap" size={10} aria-hidden />
              Чіп
            </span>
          )}
          {capability.risky && (
            <span
              title="Критична дія — скасувати не можна"
              // eslint-disable-next-line sergeant-design/no-eyebrow-drift
              className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-bold text-warning bg-warning/10 border border-warning/40 rounded-full px-1.5 py-0.5"
            >
              <Icon name="alert-triangle" size={10} aria-hidden />
              Ризик
            </span>
          )}
        </span>
        <span className="block text-xs text-subtle mt-0.5">
          {capability.description}
        </span>
      </span>
      <span aria-hidden className="shrink-0 text-subtle pt-1">
        <Icon
          name={capability.requiresInput ? "chevron-right" : "send"}
          size={14}
        />
      </span>
    </button>
  );
}

// Re-export module order for tests / future deep-links.
export { CAPABILITY_MODULE_ORDER };
