/**
 * Rule-based recommendation engine.
 * Reads data from localStorage and generates cross-module nudges.
 */

import { getCategory } from "../../modules/finyk/utils";
import { manualCategoryToCanonicalId } from "../../modules/finyk/domain/personalization";

function safeLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysBetween(isoA, isoB) {
  const a = new Date(isoA);
  const b = new Date(isoB);
  return Math.round(Math.abs(b - a) / 86_400_000);
}

function startOfCurrentMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

const MUSCLE_LABELS_UK = {
  chest: "Груди",
  back: "Спина",
  legs: "Ноги",
  shoulders: "Плечі",
  biceps: "Біцепс",
  triceps: "Триципс",
  core: "Прес",
  glutes: "Сідниці",
  hamstrings: "Задня поверхня стегна",
  calves: "Литки",
};

function parseFizrukWorkouts() {
  const raw = localStorage.getItem("fizruk_workouts_v1");
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p)) return p;
    if (p && Array.isArray(p.workouts)) return p.workouts;
  } catch {}
  return [];
}

function getExerciseMuscles(exercise) {
  const muscles = [];
  const ex = exercise || {};
  const name = (ex.nameUk || ex.name || ex.exercise || "").toLowerCase();
  if (/присід|squat/.test(name)) muscles.push("legs");
  if (/жим|press|bench/.test(name)) muscles.push("chest");
  if (/тяга|row|pull|deadlift/.test(name)) muscles.push("back");
  if (/плечей|lateral|shoulder|press overhead/.test(name))
    muscles.push("shoulders");
  if (/біцепс|curl|bicep/.test(name)) muscles.push("biceps");
  if (/триципс|tricep|dip/.test(name)) muscles.push("triceps");
  if (/прес|plank|crunch|abs/.test(name)) muscles.push("core");
  if (/ягодиц|glute|lunge/.test(name)) muscles.push("glutes");
  const muscleGroups = ex.muscleGroups || ex.muscles || [];
  if (Array.isArray(muscleGroups)) {
    for (const g of muscleGroups) muscles.push(String(g).toLowerCase());
  }
  return [...new Set(muscles)];
}

function buildMuscleLastTrained(workouts) {
  const last = {};
  const completed = workouts.filter((w) => w.endedAt);
  for (const w of completed) {
    for (const item of w.items || []) {
      const muscles = getExerciseMuscles(item);
      for (const m of muscles) {
        if (!last[m] || w.startedAt > last[m]) {
          last[m] = w.startedAt;
        }
      }
    }
  }
  return last;
}

function startOfWeek(d) {
  const x = new Date(d);
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow);
  x.setHours(0, 0, 0, 0);
  return x;
}

function txTimestamp(tx) {
  return tx.time > 1e10 ? tx.time : tx.time * 1000;
}

function buildFinanceRecs() {
  const recs = [];
  const now = new Date();
  const monthStart = startOfCurrentMonth();
  const txCache = safeLS("finyk_tx_cache", null);
  const transactions = txCache?.txs || (Array.isArray(txCache) ? txCache : []);
  const budgets = safeLS("finyk_budgets", []);
  const txCategories = safeLS("finyk_tx_cats", {});
  const customCategories = safeLS("finyk_custom_cats_v1", []);
  const hiddenTxIds = new Set(safeLS("finyk_hidden_txs", []));
  const transferIds = new Set(
    Object.entries(txCategories)
      .filter(([, v]) => v === "internal_transfer")
      .map(([k]) => k),
  );
  const manualExpenses = safeLS("finyk_manual_expenses_v1", []);

  const thisMonthTx = transactions.filter((tx) => {
    if (hiddenTxIds.has(tx.id)) return false;
    if (transferIds.has(tx.id)) return false;
    const ts = txTimestamp(tx);
    return new Date(ts) >= monthStart;
  });

  const categorySpend = {};
  for (const tx of thisMonthTx) {
    if ((tx.amount ?? 0) >= 0) continue;
    const catId = txCategories[tx.id] || "other";
    categorySpend[catId] =
      (categorySpend[catId] || 0) + Math.abs(tx.amount / 100);
  }
  for (const me of manualExpenses) {
    const ts = new Date(me.date).getTime();
    if (ts < monthStart.getTime()) continue;
    const catId = me.category || "other";
    categorySpend[catId] = (categorySpend[catId] || 0) + Math.abs(me.amount);
  }

  const limits = budgets.filter((b) => b.type === "limit");
  for (const limit of limits) {
    const spent = categorySpend[limit.categoryId] || 0;
    if (!limit.limit || limit.limit <= 0) continue;
    const pct = spent / limit.limit;
    let catLabel = limit.categoryId;
    const found = customCategories.find((c) => c.id === limit.categoryId);
    if (found) catLabel = found.label;
    else {
      const BUILTIN = {
        food: "Продукти",
        cafe: "Кафе та ресторани",
        transport: "Транспорт",
        entertainment: "Розваги",
        health: "Здоров'я",
        shopping: "Покупки",
        utilities: "Комунальні",
        other: "Інше",
      };
      catLabel = BUILTIN[limit.categoryId] || catLabel;
    }
    if (pct >= 1.4) {
      recs.push({
        id: `budget_over_${limit.categoryId}`,
        module: "finyk",
        priority: 90,
        icon: "💸",
        title: `Бюджет "${catLabel}" перевищено на ${Math.round((pct - 1) * 100)}%`,
        body: `Витрачено ${Math.round(spent).toLocaleString("uk-UA")} ₴ з ${Math.round(limit.limit).toLocaleString("uk-UA")} ₴`,
        action: "finyk",
      });
    } else if (pct >= 0.9) {
      recs.push({
        id: `budget_warn_${limit.categoryId}`,
        module: "finyk",
        priority: 60,
        icon: "⚠️",
        title: `Ліміт "${catLabel}" майже вичерпано`,
        body: `${Math.round(pct * 100)}% бюджету витрачено цього місяця`,
        action: "finyk",
      });
    }
  }

  // Тренд витрат: цей тиждень vs минулий тиждень (тільки якщо вже минув ≥3 дні)
  const thisWeekStart = startOfWeek(now);
  const prevWeekStart = new Date(thisWeekStart);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);
  const dowIdx = (now.getDay() + 6) % 7; // 0=Mon
  if (dowIdx >= 2) {
    const sumSpending = (start, end) => {
      let s = 0;
      for (const tx of transactions) {
        if (hiddenTxIds.has(tx.id) || transferIds.has(tx.id)) continue;
        if ((tx.amount ?? 0) >= 0) continue;
        const ts = txTimestamp(tx);
        if (ts >= start.getTime() && ts < end.getTime()) {
          s += Math.abs(tx.amount / 100);
        }
      }
      for (const me of manualExpenses) {
        const ts = new Date(me.date).getTime();
        if (ts >= start.getTime() && ts < end.getTime()) {
          s += Math.abs(Number(me.amount) || 0);
        }
      }
      return s;
    };
    // Поточний тиждень — нормалізуємо до того ж дня тижня для чесного порівняння
    const cmpEnd = new Date(thisWeekStart);
    cmpEnd.setDate(cmpEnd.getDate() + dowIdx + 1);
    const prevCmpEnd = new Date(prevWeekStart);
    prevCmpEnd.setDate(prevCmpEnd.getDate() + dowIdx + 1);
    const thisSpend = sumSpending(thisWeekStart, cmpEnd);
    const prevSpend = sumSpending(prevWeekStart, prevCmpEnd);
    if (prevSpend >= 500 && thisSpend > 0) {
      const ratio = thisSpend / prevSpend;
      if (ratio >= 1.4) {
        const pctMore = Math.round((ratio - 1) * 100);
        recs.push({
          id: "spending_velocity_high",
          module: "finyk",
          priority: 75,
          icon: "📈",
          title: `Витрати на ${pctMore}% вище ніж минулого тижня`,
          body: `За такий же проміжок: ${Math.round(thisSpend).toLocaleString("uk-UA")} ₴ vs ${Math.round(prevSpend).toLocaleString("uk-UA")} ₴`,
          action: "finyk",
        });
      } else if (ratio <= 0.6) {
        const pctLess = Math.round((1 - ratio) * 100);
        recs.push({
          id: "spending_velocity_low",
          module: "finyk",
          priority: 45,
          icon: "👏",
          title: `Витрати на ${pctLess}% нижче минулого тижня`,
          body: `Так тримати — ${Math.round(thisSpend).toLocaleString("uk-UA")} ₴ vs ${Math.round(prevSpend).toLocaleString("uk-UA")} ₴`,
          action: "finyk",
        });
      }
    }
  }

  // Персоналізована підказка: найчастіша категорія без встановленого ліміту.
  // Кількість використань — за ВСІ транзакції (банк + manual), а не лише за
  // поточний місяць, щоб уникнути шуму на початку місяця.
  try {
    const limitCategoryIds = new Set(
      limits.map((l) => l.categoryId).filter(Boolean),
    );
    const catCount = new Map();
    // Паралельна мапа витрат за цей місяць у canonical id. Використовується
    // нижче для `spendHint`: глобальний `categorySpend` ключований сирими
    // overrides / manual-мітками і з `best.id` (canonical) не співпадав би.
    const canonicalMonthSpend = new Map();
    const monthStartMs = monthStart.getTime();
    for (const tx of transactions) {
      if (hiddenTxIds.has(tx.id) || transferIds.has(tx.id)) continue;
      if ((tx.amount ?? 0) >= 0) continue;
      // Використовуємо `getCategory` замість сирого `txCategories[tx.id]`:
      // перший також резолвить автоматичні категорії з MCC / ключових слів
      // опису, а не лише ручні overrides, інакше правило майже не тригериться
      // для користувачів без кастомних категоризацій.
      const override = txCategories[tx.id] || null;
      const cat = getCategory(
        tx.description || "",
        tx.mcc || 0,
        override,
        customCategories,
      );
      const catId = cat?.id;
      if (!catId || catId === "internal_transfer") continue;
      catCount.set(catId, (catCount.get(catId) || 0) + 1);
      if (txTimestamp(tx) >= monthStartMs) {
        canonicalMonthSpend.set(
          catId,
          (canonicalMonthSpend.get(catId) || 0) + Math.abs(tx.amount / 100),
        );
      }
    }
    for (const me of manualExpenses) {
      // Нормалізуємо manual-підпис ("їжа") у canonical id ("food"), щоб він
      // співпадав з банківськими транзакціями та лімітами бюджету
      // (інакше `food` і `їжа` рахувалися б окремо, а перевірка лімітів
      // — які теж зберігаються за canonical id — промахувалась би повз ручні
      // витрати).
      const key = manualCategoryToCanonicalId(me.category) || "other";
      if (key === "internal_transfer") continue;
      catCount.set(key, (catCount.get(key) || 0) + 1);
      if (new Date(me.date).getTime() >= monthStartMs) {
        canonicalMonthSpend.set(
          key,
          (canonicalMonthSpend.get(key) || 0) +
            Math.abs(Number(me.amount) || 0),
        );
      }
    }
    // Знаходимо топ-категорію без бюджету; поріг — ≥5 використань, щоб
    // уникнути передчасних рекомендацій.
    let best = null;
    for (const [id, count] of catCount) {
      if (limitCategoryIds.has(id)) continue;
      if (count < 5) continue;
      if (!best || count > best.count) best = { id, count };
    }
    if (best) {
      const BUILTIN = {
        food: "Продукти",
        restaurant: "Кафе та ресторани",
        transport: "Транспорт",
        entertainment: "Розваги",
        health: "Здоров'я",
        shopping: "Покупки",
        utilities: "Комунальні",
        subscriptions: "Підписки",
        other: "Інше",
      };
      const fromCustom = customCategories.find((c) => c.id === best.id);
      const label = fromCustom?.label || BUILTIN[best.id] || best.id;
      const thisMonthSpend = Math.round(canonicalMonthSpend.get(best.id) || 0);
      const spendHint =
        thisMonthSpend > 0
          ? `Цього місяця вже ${thisMonthSpend.toLocaleString("uk-UA")} ₴ — поставте ліміт, щоб тримати руку на пульсі.`
          : `Використано ${best.count} разів — встановіть ліміт, щоб тримати все під контролем.`;
      recs.push({
        id: `finyk_frequent_no_budget_${best.id}`,
        module: "finyk",
        priority: 55,
        icon: "📌",
        title: `"${label}" — ваша найчастіша категорія без ліміту`,
        body: spendHint,
        action: "finyk",
      });
    }
  } catch {
    // дефенсивно: рекомендація опціональна, не валимо ланцюжок інших правил.
  }

  // Прогрес фінансових цілей (>=80% — фінішна пряма)
  const goals = budgets.filter((b) => b.type === "goal");
  for (const g of goals) {
    const target = Number(g.targetAmount) || 0;
    const saved = Number(g.savedAmount) || 0;
    if (target <= 0 || saved <= 0) continue;
    const p = saved / target;
    if (p >= 0.8 && p < 1) {
      const remaining = target - saved;
      recs.push({
        id: `goal_almost_${g.id || g.name}`,
        module: "finyk",
        priority: 65,
        icon: "🎯",
        title: `Ціль "${g.name}" майже досягнута`,
        body: `Залишилось ${Math.round(remaining).toLocaleString("uk-UA")} ₴ (${Math.round(p * 100)}%)`,
        action: "finyk",
      });
    }
  }

  return recs;
}

function buildFizrukRecs() {
  const recs = [];
  const workouts = parseFizrukWorkouts();
  const completed = workouts.filter((w) => w.endedAt);
  if (!completed.length) return recs;

  const sorted = [...completed].sort(
    (a, b) => new Date(b.startedAt) - new Date(a.startedAt),
  );

  const now = new Date();
  const lastMs = new Date(sorted[0].startedAt).getTime();
  const hoursAgo = (now - lastMs) / 3_600_000;
  const daysSinceWorkout = hoursAgo / 24;

  if (daysSinceWorkout > 5) {
    recs.push({
      id: "fizruk_long_break",
      module: "fizruk",
      priority: 85,
      icon: "🏋️",
      title: `${Math.round(daysSinceWorkout)} днів без тренування`,
      body: "Пора відновити активність! Навіть легке тренування краще, ніж нічого.",
      action: "fizruk",
    });
  }

  const muscleLastTrained = buildMuscleLastTrained(completed);
  const STALE_DAYS = 8;
  for (const [muscle, lastIso] of Object.entries(muscleLastTrained)) {
    const days = daysBetween(lastIso, now.toISOString());
    if (days >= STALE_DAYS) {
      const label = MUSCLE_LABELS_UK[muscle] || muscle;
      recs.push({
        id: `fizruk_muscle_${muscle}`,
        module: "fizruk",
        priority: 55 + days,
        icon: "💪",
        title: `${label} не тренували ${days} днів`,
        body: "Включи вправи на ці м'язи в наступне тренування.",
        action: "fizruk",
      });
    }
  }

  const monAgo = new Date(now);
  monAgo.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monAgo.setHours(0, 0, 0, 0);
  const weekCount = completed.filter(
    (w) => new Date(w.startedAt) >= monAgo,
  ).length;
  if (weekCount === 0 && now.getDay() >= 3) {
    recs.push({
      id: "fizruk_no_week_workout",
      module: "fizruk",
      priority: 70,
      icon: "📅",
      title: "Цього тижня ще немає тренувань",
      body: "Тиждень вже в розпалі — час запланувати тренування!",
      action: "fizruk",
    });
  }

  return recs;
}

function buildRoutineRecs() {
  const recs = [];
  const state = safeLS("hub_routine_v1", null);
  if (!state) return recs;

  const habits = (state.habits || []).filter((h) => !h.archived);
  const completions = state.completions || {};
  const today = localDateKey();

  const todayDone = habits.filter(
    (h) =>
      Array.isArray(completions[h.id]) && completions[h.id].includes(today),
  ).length;
  const total = habits.length;

  if (total === 0) return recs;

  let streak = 0;
  const d = new Date();
  d.setDate(d.getDate() - 1);
  for (let i = 0; i < 365; i++) {
    const dk = localDateKey(d);
    const allDone = habits.every(
      (h) => Array.isArray(completions[h.id]) && completions[h.id].includes(dk),
    );
    if (!allDone) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }

  const MILESTONE_STREAKS = [3, 7, 14, 30, 60, 100];
  if (MILESTONE_STREAKS.includes(streak)) {
    recs.push({
      id: `routine_streak_${streak}`,
      module: "routine",
      priority: 80,
      icon: "🔥",
      title: `${streak} днів поспіль! Вогонь!`,
      body: "Неймовірна серія! Продовжуй у тому ж дусі.",
      action: "routine",
    });
  }

  const hour = new Date().getHours();
  if (hour >= 18 && todayDone < total) {
    const remaining = total - todayDone;
    recs.push({
      id: "routine_evening_reminder",
      module: "routine",
      priority: 65,
      icon: "✅",
      title: `${remaining} звичок ще не виконано сьогодні`,
      body: "Вечір — ще не пізно закрити всі звички.",
      action: "routine",
    });
  }

  // Серія в зоні ризику: пізній вечір + є серія + сьогодні не всі виконано
  if (hour >= 21 && streak >= 7 && todayDone < total) {
    const remaining = total - todayDone;
    recs.push({
      id: "routine_streak_at_risk",
      module: "routine",
      priority: 95,
      icon: "🚨",
      title: `Серія ${streak} днів під загрозою!`,
      body: `Залишилось ${remaining} ${remaining === 1 ? "звичка" : "звичок"} — не дай рекорду згоріти.`,
      action: "routine",
    });
  }

  return recs;
}

function buildNutritionRecs() {
  const recs = [];
  const log = safeLS("nutrition_log_v1", {});
  const prefs = safeLS("nutrition_prefs_v1", null);
  const today = localDateKey();
  const dayData = log?.[today];
  const meals = Array.isArray(dayData?.meals) ? dayData.meals : [];

  let kcal = 0,
    protein = 0;
  for (const m of meals) {
    kcal += m?.macros?.kcal ?? 0;
    protein += m?.macros?.protein_g ?? 0;
  }

  const targetKcal = prefs?.dailyTargetKcal ?? 2000;
  const targetProtein =
    prefs?.dailyTargetProtein_g ?? prefs?.dailyTargetProtein ?? 120;

  const hour = new Date().getHours();

  if (meals.length === 0 && hour >= 13) {
    recs.push({
      id: "nutrition_no_meals_today",
      module: "nutrition",
      priority: 75,
      icon: "🥗",
      title: "Сьогодні ще немає записів про їжу",
      body: "Зафіксуй свій прийом їжі, щоб стежити за КБЖВ.",
      action: "nutrition",
    });
  } else if (meals.length > 0) {
    const pctKcal = kcal / targetKcal;
    if (pctKcal < 0.5 && hour >= 18) {
      recs.push({
        id: "nutrition_kcal_low",
        module: "nutrition",
        priority: 70,
        icon: "⚡",
        title: `Лише ${Math.round(kcal)} ккал з ${targetKcal} ккал цілі`,
        body: "Недостатнє споживання калорій може уповільнити відновлення.",
        action: "nutrition",
      });
    }

    const pctProtein = protein / targetProtein;
    if (pctProtein < 0.6 && hour >= 16) {
      recs.push({
        id: "nutrition_protein_low",
        module: "nutrition",
        priority: 68,
        icon: "🥩",
        title: `Лише ${Math.round(protein)}г білка з ${targetProtein}г`,
        body: "Додай протеїновий прийом їжі — це важливо для м'язів.",
        action: "nutrition",
      });
    }

    const workouts = parseFizrukWorkouts();
    const completed = workouts.filter((w) => w.endedAt);
    if (completed.length > 0) {
      const sorted = [...completed].sort(
        (a, b) => new Date(b.startedAt) - new Date(a.startedAt),
      );
      const lastHours =
        (Date.now() - new Date(sorted[0].startedAt)) / 3_600_000;
      if (lastHours < 2 && pctProtein < 0.4) {
        recs.push({
          id: "nutrition_post_workout_protein",
          module: "nutrition",
          priority: 88,
          icon: "🏆",
          title: "Після тренування — час поповнити білок!",
          body: "У вас є ~30 хвилин на протеїновий прийом для кращого відновлення.",
          action: "nutrition",
        });
      }
    }
  }

  return recs;
}

function buildWeeklyDigestRecs() {
  // Понеділок 7:00-12:00 — підсумок минулого тижня
  const now = new Date();
  if (now.getDay() !== 1) return [];
  const hour = now.getHours();
  if (hour < 7 || hour >= 12) return [];

  const monThis = startOfWeek(now);
  const monPrev = new Date(monThis);
  monPrev.setDate(monPrev.getDate() - 7);
  const sunPrev = new Date(monThis);
  sunPrev.setMilliseconds(-1);

  // Тренування
  const workouts = parseFizrukWorkouts().filter((w) => w.endedAt);
  const workoutsLastWeek = workouts.filter((w) => {
    const t = new Date(w.startedAt);
    return t >= monPrev && t <= sunPrev;
  }).length;

  // Звички
  const state = safeLS("hub_routine_v1", null);
  let habitPctText = "";
  if (state) {
    const habits = (state.habits || []).filter((h) => !h.archived);
    const completions = state.completions || {};
    if (habits.length > 0) {
      let done = 0;
      for (let i = 0; i < 7; i++) {
        const d = new Date(monPrev);
        d.setDate(monPrev.getDate() + i);
        const dk = localDateKey(d);
        for (const h of habits) {
          if (
            Array.isArray(completions[h.id]) &&
            completions[h.id].includes(dk)
          )
            done++;
        }
      }
      const total = habits.length * 7;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      habitPctText = `звички ${pct}%`;
    }
  }

  // Витрати минулого тижня
  const txCache = safeLS("finyk_tx_cache", null);
  const transactions = txCache?.txs || (Array.isArray(txCache) ? txCache : []);
  const txCategories = safeLS("finyk_tx_cats", {});
  const hiddenTxIds = new Set(safeLS("finyk_hidden_txs", []));
  const transferIds = new Set(
    Object.entries(txCategories)
      .filter(([, v]) => v === "internal_transfer")
      .map(([k]) => k),
  );
  let spendLastWeek = 0;
  for (const tx of transactions) {
    if (hiddenTxIds.has(tx.id) || transferIds.has(tx.id)) continue;
    if ((tx.amount ?? 0) >= 0) continue;
    const ts = txTimestamp(tx);
    if (ts >= monPrev.getTime() && ts <= sunPrev.getTime()) {
      spendLastWeek += Math.abs(tx.amount / 100);
    }
  }

  const parts = [];
  if (workoutsLastWeek > 0) parts.push(`${workoutsLastWeek} трен.`);
  if (habitPctText) parts.push(habitPctText);
  if (spendLastWeek > 0)
    parts.push(
      `витрати ${Math.round(spendLastWeek).toLocaleString("uk-UA")} ₴`,
    );

  if (parts.length === 0) return [];

  return [
    {
      id: `weekly_digest_${localDateKey(monPrev)}`,
      module: "hub",
      priority: 92,
      icon: "📊",
      title: "Підсумок минулого тижня",
      body: parts.join(" · "),
      action: "reports",
    },
  ];
}

/**
 * Returns sorted list of recommendations.
 * @returns {Array<{id, module, priority, icon, title, body, action}>}
 */
export function generateRecommendations() {
  const all = [
    ...buildFinanceRecs(),
    ...buildFizrukRecs(),
    ...buildRoutineRecs(),
    ...buildNutritionRecs(),
    ...buildWeeklyDigestRecs(),
  ];
  all.sort((a, b) => b.priority - a.priority);
  const seen = new Set();
  return all.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}
