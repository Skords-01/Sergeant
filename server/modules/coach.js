import pool from "../db.js";
import { anthropicMessages, extractAnthropicText } from "../lib/anthropic.js";

async function getMemory(userId) {
  const result = await pool.query(
    `SELECT data FROM module_data WHERE user_id = $1 AND module = 'coach'`,
    [userId],
  );
  if (result.rows.length === 0) return null;
  const raw = result.rows[0].data;
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return raw;
  }
}

async function saveMemory(userId, memory) {
  const blob = JSON.stringify(memory);
  await pool.query(
    `INSERT INTO module_data (user_id, module, data, client_updated_at, version)
     VALUES ($1, 'coach', $2, NOW(), 1)
     ON CONFLICT (user_id, module) DO UPDATE
       SET data = $2, server_updated_at = NOW(), version = module_data.version + 1`,
    [userId, blob],
  );
}

function mergeMemory(existing, incoming) {
  const base = existing || {
    weeklyDigests: [],
    lastInsightDate: null,
    lastInsightText: null,
  };

  const digests = Array.isArray(base.weeklyDigests)
    ? [...base.weeklyDigests]
    : [];

  if (incoming.weeklyDigest) {
    const entry = {
      weekKey: incoming.weeklyDigest.weekKey,
      weekRange: incoming.weeklyDigest.weekRange,
      generatedAt:
        incoming.weeklyDigest.generatedAt || new Date().toISOString(),
      finyk: incoming.weeklyDigest.finyk ?? null,
      fizruk: incoming.weeklyDigest.fizruk ?? null,
      nutrition: incoming.weeklyDigest.nutrition ?? null,
      routine: incoming.weeklyDigest.routine ?? null,
      overallRecommendations:
        incoming.weeklyDigest.overallRecommendations ?? [],
    };
    const existingIdx = digests.findIndex((d) => d.weekKey === entry.weekKey);
    if (existingIdx >= 0) {
      digests[existingIdx] = entry;
    } else {
      digests.push(entry);
    }
    digests.sort((a, b) => (b.weekKey > a.weekKey ? 1 : -1));
    if (digests.length > 12) digests.length = 12;
  }

  return {
    weeklyDigests: digests,
    lastInsightDate: base.lastInsightDate,
    lastInsightText: base.lastInsightText,
  };
}

function buildMemorySummary(memory) {
  if (
    !memory ||
    !Array.isArray(memory.weeklyDigests) ||
    memory.weeklyDigests.length === 0
  ) {
    return "Пам'яті ще немає — це перший сеанс.";
  }

  const lines = [];
  const digests = memory.weeklyDigests.slice(0, 8);
  lines.push(`Накопичено даних за ${digests.length} тижнів.`);

  const finykSummaries = digests
    .filter((d) => d.finyk?.summary)
    .map((d) => `  • ${d.weekRange || d.weekKey}: ${d.finyk.summary}`);
  if (finykSummaries.length) {
    lines.push("Фінанси (по тижнях):");
    lines.push(...finykSummaries.slice(0, 4));
  }

  const fizrukSummaries = digests
    .filter((d) => d.fizruk?.summary)
    .map((d) => `  • ${d.weekRange || d.weekKey}: ${d.fizruk.summary}`);
  if (fizrukSummaries.length) {
    lines.push("Тренування (по тижнях):");
    lines.push(...fizrukSummaries.slice(0, 4));
  }

  const nutritionSummaries = digests
    .filter((d) => d.nutrition?.summary)
    .map((d) => `  • ${d.weekRange || d.weekKey}: ${d.nutrition.summary}`);
  if (nutritionSummaries.length) {
    lines.push("Харчування (по тижнях):");
    lines.push(...nutritionSummaries.slice(0, 4));
  }

  const routineSummaries = digests
    .filter((d) => d.routine?.summary)
    .map((d) => `  • ${d.weekRange || d.weekKey}: ${d.routine.summary}`);
  if (routineSummaries.length) {
    lines.push("Звички (по тижнях):");
    lines.push(...routineSummaries.slice(0, 4));
  }

  const allRecs = digests
    .flatMap((d) => d.overallRecommendations || [])
    .slice(0, 6);
  if (allRecs.length) {
    lines.push("Попередні рекомендації:");
    allRecs.forEach((r) => lines.push(`  • ${r}`));
  }

  return lines.join("\n");
}

/**
 * GET /api/coach/memory — віддати поточну coach-пам'ять користувача.
 * `req.user` гарантовано заповнений middleware-ом `requireSession`.
 */
export async function coachMemoryGet(req, res) {
  const memory = await getMemory(req.user.id);
  return res.json({ ok: true, memory: memory || null });
}

/**
 * POST /api/coach/memory — merge incoming digest у збережену пам'ять.
 * `req.user` гарантовано заповнений middleware-ом `requireSession`.
 */
export async function coachMemoryPost(req, res) {
  const incoming = req.body || {};
  const existing = await getMemory(req.user.id);
  const merged = mergeMemory(existing, incoming);
  await saveMemory(req.user.id, merged);
  return res.json({ ok: true });
}

/**
 * POST /api/coach/insight — згенерувати AI-повідомлення дня.
 * `req.user`, `req.anthropicKey` і квота гарантуються middleware-ами роутера.
 */
export async function coachInsight(req, res) {
  const apiKey = req.anthropicKey;
  const { snapshot, memory } = req.body || {};

  const memorySummary = buildMemorySummary(memory);

  const snapshotLines = [];
  if (snapshot?.finyk) {
    snapshotLines.push(
      `[ФІНАНСИ ЦЬОГО ТИЖНЯ] Витрати: ${snapshot.finyk.totalSpent ?? 0} грн, Надходження: ${snapshot.finyk.totalIncome ?? 0} грн, Транзакцій: ${snapshot.finyk.txCount ?? 0}`,
    );
    if (snapshot.finyk.topCategories?.length) {
      snapshotLines.push(
        "Топ витрат: " +
          snapshot.finyk.topCategories
            .map((c) => `${c.name} ${c.amount} грн`)
            .join(", "),
      );
    }
  }
  if (snapshot?.fizruk) {
    snapshotLines.push(
      `[ТРЕНУВАННЯ ЦЬОГО ТИЖНЯ] Тренувань: ${snapshot.fizruk.workoutsCount ?? 0}, Об'єм: ${snapshot.fizruk.totalVolume ?? 0} кг, Відновлення: ${snapshot.fizruk.recoveryLabel ?? "?"}`,
    );
  }
  if (snapshot?.nutrition) {
    snapshotLines.push(
      `[ХАРЧУВАННЯ ЦЬОГО ТИЖНЯ] Середньо: ${snapshot.nutrition.avgKcal ?? 0} ккал/день (ціль ${snapshot.nutrition.targetKcal ?? 2000}), Білок: ${snapshot.nutrition.avgProtein ?? 0}г/день, Днів: ${snapshot.nutrition.daysLogged ?? 0}/7`,
    );
  }
  if (snapshot?.routine) {
    snapshotLines.push(
      `[ЗВИЧКИ ЦЬОГО ТИЖНЯ] Виконання: ${snapshot.routine.overallRate ?? 0}%, Активних звичок: ${snapshot.routine.habitCount ?? 0}`,
    );
  }

  const snapshotText = snapshotLines.length
    ? snapshotLines.join("\n")
    : "Даних за поточний тиждень ще немає.";

  const systemPrompt = `Ти персональний AI-коуч у додатку "Мій простір". Ти знаєш цю людину по місяцях даних і говориш з нею як довірений коуч — тепло, але конкретно.

ПАМ'ЯТЬ (попередні тижні):
${memorySummary}

ПОТОЧНИЙ ТИЖДЕНЬ:
${snapshotText}

Сформулюй ОДНЕ коротке проактивне повідомлення дня (2-3 речення). Воно має:
- Відзначити конкретний патерн або прогрес (з даних)
- Запропонувати одну конкретну дію на сьогодні
- Бути особистим і мотивуючим, але без загальних фраз

Відповідай ТІЛЬКИ текстом повідомлення, без вітань, без підписів, без лапок.`;

  const { response: aiRes, data: aiData } = await anthropicMessages(
    apiKey,
    {
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      messages: [{ role: "user", content: systemPrompt }],
    },
    { timeoutMs: 20000, endpoint: "coach-insight" },
  );

  if (!aiRes?.ok) {
    return res
      .status(aiRes?.status || 500)
      .json({ error: aiData?.error?.message || "AI error" });
  }

  const text = extractAnthropicText(aiData);

  return res.json({ ok: true, insight: text });
}
