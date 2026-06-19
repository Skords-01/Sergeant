import { FizrukData } from "@sergeant/fizruk-domain";
import { formatMoney, formatMoneyFromKopecks } from "@sergeant/shared";
import { safeReadStringLS } from "@shared/lib/storage/storage";
import { loadRoutineState } from "@routine/lib/routineStorage";
import { getCachedFizrukSqliteState } from "@fizruk/lib/sqliteReader";
import { loadNutritionLog } from "@nutrition/lib/nutritionStorage";
  const habits = loadRoutineState().habits;
  for (const h of habits) {
    const title = `${h.emoji || ""} ${h.name || "Звичка"}`.trim();
    const stop = pushScored(
      results,
      {
        id: `routine_h_${h.id}`,
        module: "routine",
        moduleLabel: "Рутина",
        title,
        subtitle: h.archived ? "Архівовано" : h.recurrence || "daily",
        icon: "✅",
        target: { kind: "module", moduleId: "routine" },
      },
      tokens,
      10,
    );
    if (stop) break;
  }
  return results.sort((a, b) => b._score - a._score).slice(0, 10);
}

function searchNutrition(tokens: string[]): Hit[] {
  const results: Hit[] = [];
  const seen = new Set<string>();
  // `nutrition_log_v1` is tombstoned — read the canonical SQLite warm cache.
  const log = loadNutritionLog();
  const dates = Object.keys(log).sort().reverse();

  for (const date of dates) {
    const dayLog = log[date];
    const meals = Array.isArray(dayLog?.meals) ? dayLog.meals : [];
    for (const m of meals) {
      if (!m || typeof m !== "object") continue;
      const key = m.name || `${date}_${m.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const stop = pushScored(
        results,
        {
          id: `nutrition_m_${m.id || date}`,
          module: "nutrition",
          moduleLabel: "Харчування",
          title: m.name || "Прийом їжі",
          subtitle: `${date} · ${m.macros?.kcal ?? 0} ккал`,
          icon: "🥗",
          target: { kind: "module", moduleId: "nutrition" },
        },
        tokens,
        10,
      );
      if (stop) break;
    }
    if (results.length >= 10) break;
  }
  return results.sort((a, b) => b._score - a._score).slice(0, 10);
}

/**
 * Build a cheap snapshot key that changes whenever the user's stored data
 * changes. We concatenate the raw string lengths (not full strings — avoids
 * hashing MBs of JSON) for the four scored sources. A length change always
 * means a content change; same-length edits (e.g. rename a habit) are rare
 * enough that a stale hit for one keystroke is acceptable.
 */
function storageSnapshot(): string {
  // finyk_* are still LS-backed; routine / fizruk / nutrition moved to the
  // SQLite warm caches (their `*_v1` LS keys are tombstoned). Build the cache
  // half from the canonical readers so the LRU still invalidates when that
  // data changes (counts + ids + habit/meal names catch add/remove/rename).
  const lsParts = ["finyk_tx_cache", "finyk_subs"].map((k) => {
    const v = safeReadStringLS(k);
    return v === null ? "0" : `${v.length}:${v.slice(0, 24)}:${v.slice(-24)}`;
  });
  const routine = loadRoutineState();
  const fizruk = getCachedFizrukSqliteState();
  const nutrition = loadNutritionLog();
  const fizrukWarm = fizruk.refreshedAt !== null;
  const cacheParts = [
    `r:${routine.habits.map((h) => `${h.id}${h.name ?? ""}`).join("|")}`,
    `w:${fizrukWarm ? fizruk.workouts.map((w) => w.id).join("|") : ""}`,
    `x:${fizrukWarm ? fizruk.customExercises.map((e) => e.id).join("|") : ""}`,
    `n:${Object.entries(nutrition)
      .map(([d, day]) => `${d}#${day.meals?.length ?? 0}`)
      .join("|")}`,
  ];
  return [...lsParts, ...cacheParts].join(",");
}

export function performSearch(query: string): Hit[] {
  const tokens = tokenize(query);
  // Empty query: launcher landing — only the four quick-add Actions so the
  // palette doubles as a Spotlight-style command bar (no FAB lookup needed).
  if (tokens.length === 0) return searchActions(tokens);

  // LRU(16) hit: same query + same storage snapshot → return cached results.
  const snapshot = storageSnapshot();
  const lruKey = `${query}\x00${snapshot}`;
  const cached = scoreLru.get(lruKey);
  if (cached !== undefined) return cached as Hit[];

  // Order matters for the rendered groups (see `flat`/`grouped` below).
  // Actions surface first so command-style queries («витрата», «trening»)
  // land on a do-it row before stale data; module hits follow because the
  // user may be chasing concrete records; settings + AI capabilities are
  // the «what can I do?» tail; AI handoff sits at the very end as the
  // graceful-degradation fallback when nothing structured matched.
  const results: Hit[] = [
    ...searchActions(tokens),
    ...searchFinyk(tokens),
    ...searchFizruk(tokens),
    ...searchRoutine(tokens),
    ...searchNutrition(tokens),
    ...searchSettings(tokens),
    ...searchAssistantTools(tokens),
    ...searchAiHandoff(query),
  ];
  scoreLru.set(lruKey, results);
  return results;
}
