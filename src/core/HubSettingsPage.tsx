import { useMemo, useRef, useState } from "react";
import { Button } from "@shared/components/ui/Button";
import { Icon } from "@shared/components/ui/Icon";
import { Tabs } from "@shared/components/ui/Tabs";
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
            <Button
              variant="ghost"
              size="xs"
              iconOnly
              onClick={() => setQuery("")}
              aria-label="Очистити пошук"
              className="absolute right-2 top-1/2 -translate-y-1/2"
            >
              <Icon name="close" size={14} />
            </Button>
          )}
        </label>

        {!q && (
          <Tabs
            tone="pill"
            accent="brand"
            fill
            ariaLabel="Групи налаштувань"
            items={GROUPS.map((g) => ({ value: g.id, label: g.label }))}
            value={tab}
            onChange={(v) => setTab(v)}
            className="overflow-x-auto border border-line"
          />
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
