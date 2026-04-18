import { assertAiQuota } from "../aiQuota.js";
import { setCorsHeaders } from "./lib/cors.js";
import { validateBody } from "./lib/validate.js";
import { ChatRequestSchema } from "./lib/schemas.js";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

const TOOLS = [
  {
    name: "change_category",
    description:
      "Змінити категорію транзакції. Використовуй коли користувач просить перенести транзакцію в іншу категорію.",
    input_schema: {
      type: "object",
      properties: {
        tx_id: {
          type: "string",
          description: "ID транзакції з блоку [Останні операції]",
        },
        category_id: {
          type: "string",
          description: "ID категорії з блоку [Категорії]",
        },
      },
      required: ["tx_id", "category_id"],
    },
  },
  {
    name: "create_debt",
    description: "Створити новий борг (я винен комусь).",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Назва боргу або кому винен" },
        amount: { type: "number", description: "Сума боргу в грн" },
        due_date: {
          type: "string",
          description: "Дата погашення YYYY-MM-DD (опціонально)",
        },
        emoji: {
          type: "string",
          description: "Емодзі (опціонально, за замовчуванням 💸)",
        },
      },
      required: ["name", "amount"],
    },
  },
  {
    name: "create_receivable",
    description: "Додати дебіторку (мені хтось винен).",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Хто винен" },
        amount: { type: "number", description: "Сума в грн" },
      },
      required: ["name", "amount"],
    },
  },
  {
    name: "hide_transaction",
    description: "Приховати транзакцію зі статистики.",
    input_schema: {
      type: "object",
      properties: {
        tx_id: { type: "string", description: "ID транзакції" },
      },
      required: ["tx_id"],
    },
  },
  {
    name: "set_budget_limit",
    description: "Встановити або змінити ліміт бюджету для категорії.",
    input_schema: {
      type: "object",
      properties: {
        category_id: { type: "string", description: "ID категорії" },
        limit: { type: "number", description: "Ліміт в грн на місяць" },
      },
      required: ["category_id", "limit"],
    },
  },
  {
    name: "set_monthly_plan",
    description:
      "Задати або оновити місячний фінплан (планові дохід, витрати, заощадження у грн/міс). Можна передати лише ті поля, які змінюються.",
    input_schema: {
      type: "object",
      properties: {
        income: {
          type: "number",
          description: "Плановий дохід грн/міс (опційно)",
        },
        expense: {
          type: "number",
          description: "Планові витрати грн/міс (опційно)",
        },
        savings: {
          type: "number",
          description: "Планові заощадження грн/міс (опційно)",
        },
      },
    },
  },
  {
    name: "mark_habit_done",
    description:
      "Відмітити звичку як виконану на сьогодні (або на вказану дату). ID звички беріть з блоку [Рутина сьогодні].",
    input_schema: {
      type: "object",
      properties: {
        habit_id: {
          type: "string",
          description: "ID звички (id:... з блоку [Рутина сьогодні])",
        },
        date: {
          type: "string",
          description: "Дата YYYY-MM-DD (опційно, за замовчуванням — сьогодні)",
        },
      },
      required: ["habit_id"],
    },
  },
  {
    name: "plan_workout",
    description:
      "Створити (запланувати) тренування у Фізруку на сьогодні або вказану дату/час. Можна додати список вправ із підходами/повтореннями/вагою.",
    input_schema: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description:
            "Дата тренування YYYY-MM-DD (опційно, за замовчуванням — сьогодні)",
        },
        time: {
          type: "string",
          description:
            "Час початку тренування HH:MM (опційно, за замовчуванням 09:00)",
        },
        note: {
          type: "string",
          description: "Коротка нотатка/назва тренування (опційно)",
        },
        exercises: {
          type: "array",
          description:
            "Список вправ. Кожна вправа: name (обов'язково), sets, reps, weight (опційно).",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Назва вправи" },
              sets: { type: "number", description: "Кількість підходів" },
              reps: { type: "number", description: "Повторень у підході" },
              weight: { type: "number", description: "Вага в кг" },
            },
            required: ["name"],
          },
        },
      },
    },
  },
  {
    name: "log_meal",
    description:
      "Записати прийом їжі в щоденник харчування на сьогодні. Використовуй коли користувач каже що з'їв щось і хоче записати.",
    input_schema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Назва страви або продукту",
        },
        kcal: {
          type: "number",
          description: "Калорії (ккал)",
        },
        protein_g: {
          type: "number",
          description: "Білок в грамах (опційно)",
        },
        fat_g: {
          type: "number",
          description: "Жири в грамах (опційно)",
        },
        carbs_g: {
          type: "number",
          description: "Вуглеводи в грамах (опційно)",
        },
      },
      required: ["name", "kcal"],
    },
  },
];

const SYSTEM_PREFIX = `Ти персональний асистент додатку "Мій простір". Ти маєш доступ до 4 модулів: Фінік (фінанси), Фізрук (тренування), Рутина (щоденні звички) та Харчування (нутрієнти й калорії). Відповідай ТІЛЬКИ українською, стисло (2-4 речення).

ПРАВИЛА:
- Усі числа бери з блоку ДАНІ нижче.
- Якщо потрібно порахувати (середня/день, прогноз, залишок ліміту, відсоток виконання) — рахуй на основі наданих чисел.
- Якщо користувач просить змінити або записати дані — використай відповідний tool.
  - Фінанси: change_category, create_debt, create_receivable, hide_transaction, set_budget_limit, set_monthly_plan
  - Фізрук: plan_workout (запланувати тренування на дату; можна одразу зі списком вправ)
  - Рутина: mark_habit_done (id звички з [Рутина сьогодні])
  - Харчування: log_meal (назва + ккал; білок/жири/вуглеводи опційно)
- Транзакції мають id і дату — використовуй для tool calls.
- Категорії та їх id перелічені в [Категорії].
- Відповідай на питання по всіх 4 модулях.

ДАНІ:
`;

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

  if (!(await assertAiQuota(req, res))) return;

  const parsed = validateBody(ChatRequestSchema, req, res);
  if (!parsed.ok) return;

  try {
    const {
      context = "",
      messages = [],
      tool_results,
      tool_calls_raw,
      stream,
    } = parsed.data;

    // Другий крок: клієнт виконав tool calls і повертає результати
    if (tool_results && tool_calls_raw) {
      const toolResultMessages = tool_results.map((r) => ({
        type: "tool_result",
        tool_use_id: r.tool_use_id,
        content: String(r.content || "ok"),
      }));

      // Беремо лише останнє user-повідомлення (питання що спричинило tool call)
      const lastUserMsg = [...(Array.isArray(messages) ? messages : [])]
        .reverse()
        .find(
          (m) =>
            m?.role === "user" &&
            typeof m?.content === "string" &&
            m.content.trim(),
        );

      const fullMessages = [
        ...(lastUserMsg
          ? [{ role: "user", content: lastUserMsg.content }]
          : []),
        { role: "assistant", content: tool_calls_raw },
        { role: "user", content: toolResultMessages },
      ];

      const payload = {
        model: "claude-sonnet-4-6",
        max_tokens: 400,
        system: SYSTEM_PREFIX + context,
        tools: TOOLS,
        messages: fullMessages,
      };

      if (stream) {
        await streamAnthropicToSse(res, apiKey, payload);
        return;
      }

      const response = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        return res
          .status(response.status)
          .json({ error: data?.error?.message || "AI error" });
      }

      const text = (data?.content || [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      return res.status(200).json({ text: text || "Готово." });
    }

    // Перший запит — може повернути tool_use або текст
    const cleaned = sanitizeMessages(messages);
    if (cleaned.length === 0) {
      return res.status(400).json({ error: "Немає повідомлень" });
    }

    const response = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 600,
        system: SYSTEM_PREFIX + context,
        tools: TOOLS,
        messages: cleaned,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res
        .status(response.status)
        .json({ error: data?.error?.message || "AI error" });
    }

    const content = data?.content || [];
    const toolUses = content.filter((b) => b.type === "tool_use");
    const textParts = content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    if (toolUses.length > 0) {
      return res.status(200).json({
        text: textParts || null,
        tool_calls: toolUses.map((t) => ({
          id: t.id,
          name: t.name,
          input: t.input,
        })),
        tool_calls_raw: content,
      });
    }

    return res
      .status(200)
      .json({ text: textParts || "Немає відповіді від AI." });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Помилка AI сервера" });
  }
}

/**
 * Anthropic Messages API stream → SSE для клієнта (data: {"t":"фрагмент"}).
 */
async function streamAnthropicToSse(res, apiKey, payload) {
  const response = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ ...payload, stream: true }),
  });

  if (!response.ok) {
    let errMsg = "AI error";
    try {
      const j = await response.json();
      errMsg = j?.error?.message || errMsg;
    } catch {
      try {
        errMsg = await response.text();
      } catch {
        /* ignore */
      }
    }
    res.status(response.status).json({ error: errMsg });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no");

  const reader = response.body?.getReader();
  if (!reader) {
    res.status(500).json({ error: "No response body" });
    return;
  }

  const decoder = new TextDecoder();
  let lineBuf = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      lineBuf += decoder.decode(value, { stream: true });
      for (;;) {
        const nl = lineBuf.indexOf("\n");
        if (nl === -1) break;
        const line = lineBuf.slice(0, nl).replace(/\r$/, "");
        lineBuf = lineBuf.slice(nl + 1);
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (raw === "[DONE]") continue;
        let ev;
        try {
          ev = JSON.parse(raw);
        } catch {
          continue;
        }
        if (
          ev.type === "content_block_delta" &&
          ev.delta?.type === "text_delta" &&
          ev.delta.text
        ) {
          res.write(`data: ${JSON.stringify({ t: ev.delta.text })}\n\n`);
        }
      }
    }
  } catch (e) {
    res.write(`data: ${JSON.stringify({ err: String(e?.message || e) })}\n\n`);
  }
  res.write("data: [DONE]\n\n");
  res.end();
}

function sanitizeMessages(messages) {
  const cleaned = (Array.isArray(messages) ? messages : [])
    .filter(
      (m) =>
        (m?.role === "user" || m?.role === "assistant") &&
        typeof m?.content === "string" &&
        m.content.trim(),
    )
    .slice(-12);

  // Anthropic вимагає чергування user/assistant і початок з user
  const result = [];
  for (const m of cleaned) {
    if (result.length > 0 && result[result.length - 1].role === m.role)
      continue;
    result.push(m);
  }
  while (result.length > 0 && result[0].role !== "user") result.shift();
  while (result.length > 0 && result[result.length - 1].role !== "user")
    result.pop();

  return result;
}
