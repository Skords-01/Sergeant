import { useMemo, useRef, useState } from "react";
import { cn } from "@shared/lib/cn";
import { Icon } from "@shared/components/ui/Icon";
import { AIDigestSection } from "./settings/AIDigestSection.jsx";
import { ExperimentalSection } from "./settings/ExperimentalSection.jsx";
import { FinykSection } from "./settings/FinykSection.jsx";
import { FizrukSection } from "./settings/FizrukSection.jsx";
import { GeneralSection } from "./settings/GeneralSection.jsx";
import { NotificationsSection } from "./settings/NotificationsSection.jsx";
import { RoutineSection } from "./settings/RoutineSection.jsx";

// Group definitions: each tab collects related sections. Search terms are
// used for fuzzy search-by-keyword; matches fall back to showing every
// section that contains the term.
const GROUPS = [
  {
    id: "general",
    label: "Загальні",
    sections: ["general", "notifications", "ai"],
  },
  {
    id: "modules",
    label: "Модулі",
    sections: ["routine", "fizruk", "finyk"],
  },
  {
    id: "advanced",
    label: "Додатково",
    sections: ["experimental"],
  },
];

export function HubSettingsPage({
  dark,
  onToggleDark,
  syncing,
  onSync,
  onPull,
  user,
}) {
  const [tab, setTab] = useState("general");
  const [query, setQuery] = useState("");
  const refs = useRef({});

  // Sections with the keywords a user might type to find them. The labels
  // match the <h3>/<h4> headings used by each Section component.
  const sections = useMemo(
    () => [
      {
        id: "general",
        title: "Інтерфейс і синхронізація",
        keywords:
          "загальні тема темна світла мова інтерфейс синхронізація акаунт sync cloud backup",
        render: () => (
          <GeneralSection
            dark={dark}
            onToggleDark={onToggleDark}
            syncing={syncing}
            onSync={onSync}
            onPull={onPull}
            user={user}
          />
        ),
      },
      {
        id: "notifications",
        title: "Нагадування",
        keywords:
          "сповіщення нагадування пуш push notifications reminders щоденні",
        render: () => <NotificationsSection />,
      },
      {
        id: "ai",
        title: "AI-дайджести",
        keywords:
          "ai штучний інтелект дайджест digest тижневий тренер coach insights",
        render: () => <AIDigestSection />,
      },
      {
        id: "routine",
        title: "Рутина",
        keywords: "звички рутина habits streak ціль reset",
        render: () => <RoutineSection />,
      },
      {
        id: "fizruk",
        title: "Фізрук",
        keywords: "фізрук тренування кардіо вага workouts gym fitness",
        render: () => <FizrukSection />,
      },
      {
        id: "finyk",
        title: "Фінік",
        keywords:
          "фінанси фінік finyk monobank privatbank token api transactions budget",
        render: () => <FinykSection />,
      },
      {
        id: "experimental",
        title: "Експериментальні",
        keywords: "experimental lab beta debug розробка розробник developer",
        render: () => <ExperimentalSection />,
      },
    ],
    [dark, onToggleDark, syncing, onSync, onPull, user],
  );

  const q = query.trim().toLowerCase();
  const matchesQuery = (s) =>
    !q ||
    s.title.toLowerCase().includes(q) ||
    s.keywords.toLowerCase().includes(q);

  const visibleSectionIds = q
    ? sections.filter(matchesQuery).map((s) => s.id)
    : GROUPS.find((g) => g.id === tab)?.sections || [];

  const visible = sections.filter((s) => visibleSectionIds.includes(s.id));

  return (
    <div className="flex flex-col gap-3 pt-2 pb-4">
      <div className="flex flex-col gap-3">
        <label className="relative block">
          <span className="sr-only">Пошук по налаштуваннях</span>
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
            <Icon name="search" size={16} />
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Пошук налаштувань"
            className="w-full min-h-[44px] pl-9 pr-10 py-3 bg-panelHi border border-line rounded-2xl text-[16px] md:text-sm text-text placeholder:text-muted outline-none focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/30 transition-colors"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Очистити пошук"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-xl text-muted hover:text-text hover:bg-panel transition-colors"
            >
              <Icon name="close" size={14} />
            </button>
          )}
        </label>

        {!q && (
          <div
            role="tablist"
            className="flex gap-1 p-1 rounded-2xl bg-panelHi border border-line overflow-x-auto"
          >
            {GROUPS.map((g) => {
              const active = tab === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(g.id)}
                  className={cn(
                    "flex-1 min-w-[100px] min-h-[40px] px-3 py-2 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/45",
                    active
                      ? "bg-panel text-text shadow-sm"
                      : "text-muted hover:text-text",
                  )}
                >
                  {g.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="text-sm text-muted text-center py-6">
          Нічого не знайдено за запитом «{query}»
        </div>
      ) : (
        visible.map((s) => (
          <div key={s.id} ref={(el) => (refs.current[s.id] = el)}>
            {s.render()}
          </div>
        ))
      )}
    </div>
  );
}
