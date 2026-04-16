import { setCorsHeaders } from "./lib/cors.js";

export default async function handler(req, res) {
  setCorsHeaders(res, req, {
    allowHeaders: "Content-Type",
    methods: "POST, OPTIONS",
  });

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey)
    return res.status(500).json({ error: "ANTHROPIC_API_KEY is not set" });

  try {
    const { weekRange, finyk, fizruk, nutrition, routine } = req.body || {};

    const sections = [];

    if (finyk) {
      const budgetLine = finyk.monthlyBudget
        ? `Місячний бюджет: ${finyk.monthlyBudget} грн`
        : "Місячний бюджет: не встановлено";
      const topCats =
        Array.isArray(finyk.topCategories) && finyk.topCategories.length
          ? finyk.topCategories.map((c) => `  - ${c.name}: ${c.amount} грн`).join("\n")
          : "  Немає даних";
      sections.push(`[ФІНАНСИ (${weekRange || "тиждень"})]
Витрати: ${finyk.totalSpent ?? 0} грн | Надходження: ${finyk.totalIncome ?? 0} грн
${budgetLine}
Топ категорії витрат:
${topCats}
Транзакцій: ${finyk.txCount ?? 0}`);
    }

    if (fizruk) {
      const exercises =
        Array.isArray(fizruk.topExercises) && fizruk.topExercises.length
          ? fizruk.topExercises.map((e) => `  - ${e.name}: ${e.totalVolume} кг`).join("\n")
          : "  Немає даних";
      sections.push(`[ТРЕНУВАННЯ (${weekRange || "тиждень"})]
Тренувань завершено: ${fizruk.workoutsCount ?? 0}
Загальний об'єм: ${fizruk.totalVolume ?? 0} кг
Стан відновлення: ${fizruk.recoveryLabel ?? "Немає даних"}
Топ вправи:
${exercises}`);
    }

    if (nutrition) {
      const deficit = (nutrition.targetKcal ?? 0) - (nutrition.avgKcal ?? 0);
      const balance =
        deficit > 50
          ? `дефіцит ${Math.round(deficit)} ккал`
          : deficit < -50
            ? `профіцит ${Math.round(Math.abs(deficit))} ккал`
            : "баланс";
      sections.push(`[ХАРЧУВАННЯ (${weekRange || "тиждень"})]
Середньодобово: ${nutrition.avgKcal ?? 0} ккал (ціль ${nutrition.targetKcal ?? 2000} ккал, ${balance})
Середній БЖВ: Б ${nutrition.avgProtein ?? 0}г / Ж ${nutrition.avgFat ?? 0}г / В ${nutrition.avgCarbs ?? 0}г
Днів із записами: ${nutrition.daysLogged ?? 0} з 7`);
    }

    if (routine) {
      const habitsInfo =
        Array.isArray(routine.habits) && routine.habits.length
          ? routine.habits
              .map((h) => `  - ${h.name}: ${h.completionRate}% (${h.done}/${h.total} днів)`)
              .join("\n")
          : "  Немає активних звичок";
      sections.push(`[ЗВИЧКИ (${weekRange || "тиждень"})]
Загальний відсоток: ${routine.overallRate ?? 0}%
Активних звичок: ${routine.habitCount ?? 0}
По звичках:
${habitsInfo}`);
    }

    if (!sections.length) {
      return res.status(400).json({ error: "Немає даних для генерації звіту" });
    }

    const dataContext = sections.join("\n\n");
    const userPrompt = `Проаналізуй тижневі дані юзера і поверни ТІЛЬКИ валідний JSON (без markdown-обгортки, без \`\`\`json) такого вигляду:
{
  "finyk": {
    "summary": "1 речення: що відбулося з фінансами",
    "comment": "2-3 речення: аналіз витрат, тенденції",
    "recommendations": ["рекомендація 1", "рекомендація 2"]
  },
  "fizruk": {
    "summary": "1 речення: підсумок тренувань",
    "comment": "2-3 речення: аналіз об'єму, відновлення",
    "recommendations": ["рекомендація 1", "рекомендація 2"]
  },
  "nutrition": {
    "summary": "1 речення: підсумок харчування",
    "comment": "2-3 речення: аналіз калоражу, макросів",
    "recommendations": ["рекомендація 1", "рекомендація 2"]
  },
  "routine": {
    "summary": "1 речення: підсумок звичок",
    "comment": "2-3 речення: аналіз виконання",
    "recommendations": ["рекомендація 1", "рекомендація 2"]
  },
  "overallRecommendations": ["загальна рекомендація 1", "загальна рекомендація 2"]
}
Якщо даних по модулю немає — поверни null для цього ключа. Відповідай ВИКЛЮЧНО валідним JSON.`;

    const port = process.env.PORT || 5000;
    const chatRes = await fetch(`http://localhost:${port}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context: dataContext,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    const chatData = await chatRes.json();
    if (!chatRes.ok) {
      return res
        .status(chatRes.status)
        .json({ error: chatData?.error || "AI error" });
    }

    const text = chatData?.text || "";

    let report;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      report = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch {
      return res
        .status(500)
        .json({ error: "Не вдалося розпарсити відповідь AI", raw: text });
    }

    return res
      .status(200)
      .json({ report, generatedAt: new Date().toISOString() });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Помилка сервера" });
  }
}
