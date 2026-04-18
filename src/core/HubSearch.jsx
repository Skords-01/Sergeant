import { useState, useEffect, useRef } from "react";
import { cn } from "@shared/lib/cn";
import { Icon } from "@shared/components/ui/Icon";
import { EmptyState } from "@shared/components/ui/EmptyState";

function safeParseLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) ?? fallback;
  } catch {
    return fallback;
  }
}

function parseFizrukWorkouts(raw) {
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p)) return p;
    if (p && Array.isArray(p.workouts)) return p.workouts;
  } catch {}
  return [];
}

function parseFizrukCustomExercises(raw) {
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p)) return p;
    if (p && Array.isArray(p.exercises)) return p.exercises;
  } catch {}
  return [];
}

function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function searchFinyk(query) {
  const q = query.toLowerCase();
  const results = [];

  const txList = safeParseLS("finyk_tx_cache", []);
  if (Array.isArray(txList)) {
    for (const tx of txList) {
      if (!tx || typeof tx !== "object") continue;
      const desc = (tx.description || tx.comment || "").toLowerCase();
      const mcc = String(tx.mcc || "");
      if (desc.includes(q) || mcc.includes(q)) {
        const amtRaw = Number(tx.amount);
        const amount = (Number.isFinite(amtRaw) ? amtRaw : 0) / 100;
        const sign = amount < 0 ? "−" : "+";
        results.push({
          id: `finyk_tx_${tx.id || tx.time}`,
          module: "finyk",
          moduleLabel: "Фінік",
          title: tx.description || tx.comment || "Транзакція",
          subtitle: `${sign}${Math.abs(amount).toLocaleString("uk-UA", { maximumFractionDigits: 2 })} ₴ · ${tx.time > 1e10 ? localDateKey(new Date(tx.time)) : localDateKey(new Date(tx.time * 1000))}`,
          icon: "💳",
        });
        if (results.length >= 20) break;
      }
    }
  }

  const subs = safeParseLS("finyk_subs", []);
  if (Array.isArray(subs)) {
    for (const s of subs) {
      if (!s || typeof s !== "object") continue;
      if ((s.name || "").toLowerCase().includes(q)) {
        const amtRaw = Number(s.amount);
        const amt = Number.isFinite(amtRaw) && amtRaw > 0 ? amtRaw : 0;
        results.push({
          id: `finyk_sub_${s.id}`,
          module: "finyk",
          moduleLabel: "Фінік",
          title: s.name,
          subtitle: `Підписка · ${amt ? (amt / 100).toFixed(0) + " ₴" : ""}`,
          icon: "🔄",
        });
      }
    }
  }

  return results.slice(0, 10);
}

function searchFizruk(query) {
  const q = query.toLowerCase();
  const results = [];

  const workouts = parseFizrukWorkouts(
    localStorage.getItem("fizruk_workouts_v1"),
  );
  if (workouts.length > 0) {
    for (const w of workouts) {
      if (!w || typeof w !== "object") continue;
      const note = (w.note || "").toLowerCase();
      const itemsRaw = Array.isArray(w.items) ? w.items : [];
      const exercises = itemsRaw.map((i) =>
        ((i && (i.exerciseName || i.name)) || "").toLowerCase(),
      );
      const matchNote = note.includes(q);
      const matchExercise = exercises.some((e) => e.includes(q));
      if (matchNote || matchExercise) {
        const dateLabel = w.startedAt
          ? localDateKey(new Date(w.startedAt))
          : "";
        const exNames = itemsRaw
          .slice(0, 2)
          .map((i) => (i && (i.exerciseName || i.name)) || "")
          .filter(Boolean);
        results.push({
          id: `fizruk_w_${w.id}`,
          module: "fizruk",
          moduleLabel: "Фізрук",
          title: w.note || exNames.join(", ") || "Тренування",
          subtitle:
            dateLabel + (itemsRaw.length ? ` · ${itemsRaw.length} вправ` : ""),
          icon: "🏋️",
        });
      }
      if (results.length >= 10) break;
    }
  }

  const exercises = parseFizrukCustomExercises(
    localStorage.getItem("fizruk_custom_exercises_v1"),
  );
  for (const e of exercises) {
    if (!e || typeof e !== "object") continue;
    if (
      (e.name || "").toLowerCase().includes(q) ||
      (Array.isArray(e.muscles) ? e.muscles : [])
        .join(" ")
        .toLowerCase()
        .includes(q)
    ) {
      results.push({
        id: `fizruk_ex_${e.id}`,
        module: "fizruk",
        moduleLabel: "Фізрук",
        title: e.name || "Вправа",
        subtitle:
          (Array.isArray(e.muscles) ? e.muscles : []).join(", ") ||
          "Власна вправа",
        icon: "💪",
      });
      if (results.length >= 15) break;
    }
  }

  return results.slice(0, 10);
}

function searchRoutine(query) {
  const q = query.toLowerCase();
  const results = [];

  const state = safeParseLS("hub_routine_v1", null);
  if (!state) return results;

  const habits = Array.isArray(state.habits) ? state.habits : [];
  for (const h of habits) {
    if (!h || typeof h !== "object") continue;
    if (
      (h.name || "").toLowerCase().includes(q) ||
      (h.note || "").toLowerCase().includes(q) ||
      (h.emoji || "").includes(q)
    ) {
      results.push({
        id: `routine_h_${h.id}`,
        module: "routine",
        moduleLabel: "Рутина",
        title: `${h.emoji || ""} ${h.name || "Звичка"}`.trim(),
        subtitle: h.archived ? "Архівовано" : h.recurrence || "daily",
        icon: "✅",
      });
    }
    if (results.length >= 10) break;
  }

  return results;
}

function searchNutrition(query) {
  const q = query.toLowerCase();
  const results = [];
  const seen = new Set();

  const log = safeParseLS("nutrition_log_v1", {});
  const dates = Object.keys(log).sort().reverse();

  for (const date of dates) {
    const meals = Array.isArray(log[date]?.meals) ? log[date].meals : [];
    for (const m of meals) {
      const name = (m.name || "").toLowerCase();
      if (name.includes(q)) {
        const key = m.name;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({
            id: `nutrition_m_${m.id || date}`,
            module: "nutrition",
            moduleLabel: "Харчування",
            title: m.name || "Прийом їжі",
            subtitle: `${date} · ${m.macros?.kcal ?? 0} ккал`,
            icon: "🥗",
          });
        }
        if (results.length >= 10) break;
      }
    }
    if (results.length >= 10) break;
  }

  return results;
}

function performSearch(query) {
  if (!query.trim() || query.trim().length < 2) return [];

  const finykResults = searchFinyk(query);
  const fizrukResults = searchFizruk(query);
  const routineResults = searchRoutine(query);
  const nutritionResults = searchNutrition(query);

  return [
    ...finykResults,
    ...fizrukResults,
    ...routineResults,
    ...nutritionResults,
  ];
}

const MODULE_COLORS = {
  finyk: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  fizruk: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  routine: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  nutrition: "bg-lime-500/10 text-lime-700 dark:text-lime-500",
};

export function HubSearch({ onClose, onOpenModule }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      setResults(performSearch(query));
    }, 150);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const grouped = results.reduce((acc, r) => {
    if (!acc[r.module]) acc[r.module] = { label: r.moduleLabel, items: [] };
    acc[r.module].items.push(r);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-bg safe-area-pt-pb page-enter">
      <div className="px-4 pt-4 pb-2 flex items-center gap-3 border-b border-line">
        <div className="flex-1 relative">
          <Icon
            name="search"
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
          />
          <input
            ref={inputRef}
            type="search"
            placeholder="Пошук по всіх модулях..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-11 pl-10 pr-4 rounded-2xl bg-panelHi border border-line text-text placeholder:text-muted text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
          />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-sm text-muted hover:text-text transition-colors"
        >
          Скасувати
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {query.trim().length >= 2 && results.length === 0 && (
          <EmptyState
            icon={<Icon name="search" size={22} strokeWidth={1.6} />}
            title="Нічого не знайдено"
            description={`За запитом «${query}» нічого не знайшлося. Спробуй іншу фразу.`}
          />
        )}

        {query.trim().length < 2 && (
          <EmptyState
            icon={<Icon name="search" size={22} strokeWidth={1.6} />}
            title="Глобальний пошук"
            description="Транзакції, тренування, звички, їжа — все в одному місці."
          />
        )}

        {Object.entries(grouped).map(([moduleId, group]) => (
          <div key={moduleId}>
            <p className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onOpenModule(moduleId);
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-panelHi active:bg-panelHi transition-colors text-left"
                >
                  <span
                    className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center text-sm shrink-0",
                      MODULE_COLORS[moduleId],
                    )}
                  >
                    {item.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text truncate">{item.title}</p>
                    <p className="text-xs text-muted truncate">
                      {item.subtitle}
                    </p>
                  </div>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-muted/40 shrink-0"
                    aria-hidden
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
