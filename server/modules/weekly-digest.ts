import type { Request, Response } from "express";
import { anthropicMessages, extractAnthropicText } from "../lib/anthropic.js";
import { validateBody } from "../http/validate.js";
import { WeeklyDigestSchema } from "../http/schemas.js";
import { ExternalServiceError, ValidationError } from "../obs/errors.js";

type WithAnthropicKey = Request & { anthropicKey?: string };

interface AnthropicErrorPayload {
  error?: { message?: string };
}

function extractJsonObject(raw: unknown): unknown {
  if (typeof raw !== "string") return null;
  let text = raw.trim();
  // Прибираємо markdown-обгортку ```json ... ``` або ``` ... ```
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();

  const start = text.indexOf("{");
  if (start < 0) return null;

  // Знаходимо відповідну закриваючу дужку з урахуванням рядків та екранування.
  let depth = 0;
  let inStr = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const candidate = text.slice(start, i + 1);
        try {
          return JSON.parse(candidate);
        } catch {
          return null;
        }
      }
    }
  }
  // Жорсткий fallback: спробувати розпарсити «as is»
  try {
    return JSON.parse(text.slice(start));
  } catch {
    return null;
  }
}

/**
 * POST /api/weekly-digest — згенерувати тижневий звіт. CORS/method/key/quota
 * забезпечені middleware-ами роутера; тут лише бізнес-логіка. Ключ Anthropic
 * читається з `req.anthropicKey`.
 */
export default async function handler(
  req: Request,
  res: Response,
): Promise<void> {
  const apiKey = (req as WithAnthropicKey).anthropicKey as string;

  const parsed = validateBody(WeeklyDigestSchema, req, res);
  if (!parsed.ok) return;
  const { weekRange, finyk, fizruk, nutrition, routine } = parsed.data;

  const sections: string[] = [];

  if (finyk) {
    const budgetLine = finyk.monthlyBudget
      ? `Місячний бюджет: ${finyk.monthlyBudget} грн`
      : "Місячний бюджет: не встановлено";
    const topCats =
      Array.isArray(finyk.topCategories) && finyk.topCategories.length
        ? finyk.topCategories
            .map((c) => `  - ${c.name}: ${c.amount} грн`)
            .join("\n")
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
        ? fizruk.topExercises
            .map((e) => `  - ${e.name}: ${e.totalVolume} кг`)
            .join("\n")
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
            .map(
              (h) =>
                `  - ${h.name}: ${h.completionRate}% (${h.done}/${h.total} днів)`,
            )
            .join("\n")
        : "  Немає активних звичок";
    sections.push(`[ЗВИЧКИ (${weekRange || "тиждень"})]
Загальний відсоток: ${routine.overallRate ?? 0}%
Активних звичок: ${routine.habitCount ?? 0}
По звичках:
${habitsInfo}`);
  }

  if (!sections.length) {
    throw new ValidationError("Немає даних для генерації звіту");
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

  const systemPrompt = `Ти аналітик персональних даних користувача додатку "Мій простір".
Відповідай ВИКЛЮЧНО валідним JSON — без markdown, без коментарів, без преамбули.
Уся аналітика — українською. Числа бери з блоку даних.

ДАНІ:
${dataContext}`;

  const { response: aiRes, data: aiData } = await anthropicMessages(
    apiKey,
    {
      model: "claude-sonnet-4-6",
      max_tokens: 2500,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    },
    { timeoutMs: 45000, endpoint: "weekly-digest" },
  );

  if (!aiRes?.ok) {
    const errData = aiData as AnthropicErrorPayload | null | undefined;
    throw new ExternalServiceError(errData?.error?.message || "AI error", {
      status: aiRes?.status || 502,
      code: "ANTHROPIC_ERROR",
    });
  }

  const text = extractAnthropicText(aiData);

  const report = extractJsonObject(text);
  if (!report) {
    throw new ExternalServiceError("Не вдалося розпарсити відповідь AI", {
      status: 502,
      code: "ANTHROPIC_PARSE_ERROR",
    });
  }

  res.status(200).json({ report, generatedAt: new Date().toISOString() });
}
