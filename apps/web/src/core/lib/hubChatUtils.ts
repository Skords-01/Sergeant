// Utility functions shared across HubChat modules

import { friendlyApiError as baseFriendlyApiError } from "@shared/lib/friendlyApiError";

export const CONTEXT_TTL_MS = 15_000;
export const CHAT_HISTORY_WRITE_DEBOUNCE_MS = 600;

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  /** Optional extra fields preserved from persisted history. */
  [key: string]: unknown;
}

/**
 * HubChat-специфічний `friendlyApiError`. Додає два кейси поверх
 * загального мапера в `@shared/lib/friendlyApiError`:
 *  - 500 без ключа AI → окремий текст про чат;
 *  - 429 з маркером AI_QUOTA / «ліміт AI» → явне повідомлення про
 *    денний ліміт (замість загального «Забагато запитів»).
 */
export function friendlyApiError(status: number, message?: string): string {
  const m = message || "";
  if (status === 500 && /ANTHROPIC|not set|key/i.test(m)) {
    return "Чат на сервері не налаштовано (немає ключа AI).";
  }
  if (status === 429 && /ліміт AI|AI_QUOTA|квот/i.test(m)) {
    return "Денний ліміт AI вичерпано. Спробуй завтра або зменш навантаження.";
  }
  return baseFriendlyApiError(status, message);
}

export function friendlyChatError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/failed to fetch|network|load failed/i.test(msg)) {
    return "Немає з'єднання з мережею або сервер недоступний.";
  }
  return `Помилка: ${msg}`;
}

/** Читає SSE з /api/chat (data: {"t":"..."} / [DONE]). Рядок за рядком — стійко до часткових чанків. */
export async function consumeHubChatSse(
  response: Response,
  onDelta: (delta: string) => void,
): Promise<void> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    for (;;) {
      const nl = buf.indexOf("\n");
      if (nl === -1) break;
      const line = buf.slice(0, nl).replace(/\r$/, "");
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (raw === "[DONE]") return;
      let j: { t?: string; err?: string };
      try {
        j = JSON.parse(raw);
      } catch {
        continue;
      }
      if (j.err) throw new Error(j.err);
      if (j.t) onDelta(j.t);
    }
  }
}

export function newMsgId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `m_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
  );
}

export function makeAssistantMsg(text: string): ChatMessage {
  return { id: newMsgId(), role: "assistant", text };
}

export function makeUserMsg(text: string): ChatMessage {
  return { id: newMsgId(), role: "user", text };
}

export function normalizeStoredMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [
      makeAssistantMsg(
        "Привіт! Я твій особистий асистент. Запитуй про фінанси (Фінік), тренування (Фізрук), звички (Рутина) або харчування. Можу також змінювати категорії, додавати борги, відмічати звички та записувати прийоми їжі.",
      ),
    ];
  }
  return raw.map((m: Partial<ChatMessage> & Record<string, unknown>, i) => ({
    role: "assistant" as ChatRole,
    text: "",
    ...m,
    id:
      (typeof m.id === "string" && m.id) ||
      `legacy_${i}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
  }));
}

export function ls<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function lsSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function fmt(n: number): string {
  return Math.round(n).toLocaleString("uk-UA");
}

type IdleHandle = number;

export function requestIdle(cb: () => void): IdleHandle {
  if (typeof window === "undefined")
    return setTimeout(cb, 0) as unknown as IdleHandle;
  if (window.requestIdleCallback)
    return window.requestIdleCallback(cb, { timeout: 800 }) as IdleHandle;
  return setTimeout(cb, 0) as unknown as IdleHandle;
}

export function cancelIdle(id: IdleHandle): void {
  if (typeof window === "undefined") return clearTimeout(id);
  if (window.cancelIdleCallback) return window.cancelIdleCallback(id);
  return clearTimeout(id);
}

const HELP_RE = /^\/(help|допомога|команди|інструменти)\s*$/i;

export function isHelpCommand(text: string): boolean {
  return HELP_RE.test(text.trim());
}

export const HELP_TEXT = `**Доступні інструменти:**

**💰 Фінік (фінанси)**
• Записати витрату/дохід — \`додай витрату 200 грн на каву\`
• Змінити категорію — \`перенеси транзакцію в їжу\`
• Приховати/видалити транзакцію
• Створити борг або дебіторку — \`я винен Олегу 500 грн\`
• Погасити борг — \`оплатив борг Олегу\`
• Ліміт бюджету — \`встанови ліміт на їжу 3000 грн\`
• Ціль заощаджень — \`створи ціль Відпустка 20000 грн\`
• Фінплан — \`встанови дохід 30000, витрати 20000\`
• Актив — \`додай актив Депозит 50000\`
• Імпорт Monobank — \`завантаж транзакції за квітень\`
• **Розділити транзакцію** — \`розділи покупку: 200 їжа, 100 побут\`
• **Підписка** — \`додай підписку Спортзал 500 грн 1-го числа\`
• **Звіт** — \`зроби звіт за тиждень\`

**🏋️ Фізрук (тренування)**
• Почати/завершити тренування — \`почни тренування\`
• Додати підхід — \`жим 80кг 8 повторень\`
• Запланувати тренування — \`заплануй ноги на завтра\`
• Програма тижня — \`додай пн: груди + трицепс\`
• Заміри — \`запиши вагу 78, біцепс 37\`
• Самопочуття — \`сон 7 год, енергія 4, настрій 5\`
• Вага — \`запиши вагу 78 кг\`
• **Порада** — \`порадь тренування на сьогодні\`
• **Копія** — \`повтори вчорашнє тренування\`
• **Прогрес** — \`як змінився мій жим за місяць?\`

**📋 Рутина (звички)**
• Створити звичку — \`додай звичку пити воду щодня\`
• Відмітити — \`познач воду на сьогодні\`
• Нагадування — \`постав нагадування о 8:00\`
• Архівувати — \`заархівуй звичку\`
• Подія — \`додай подію ДН Олега 15 травня\`
• **Редагувати** — \`зміни назву звички на Медитація\`
• **Порядок** — \`переміщуй звички\`
• **Статистика** — \`покажи статистику звички вода\`

**🍎 Харчування**
• Записати їжу — \`з'їв вівсянку 350 ккал\`
• Вода — \`випив 500 мл води\`
• Рецепт — \`збережи рецепт омлету\`
• Список покупок — \`додай молоко в список\`
• Комора — \`прибери яйця з комори\`
• Щоденний план — \`встанови ціль 2000 ккал, 120г білка\`
• **Порада їжі** — \`що з'їсти щоб добити білок?\`
• **Копія** — \`запиши те саме що вчора на обід\`
• **План меню** — \`склади меню на 2000 ккал\`

**🔗 Кросмодульні**
• **Ранковий брифінг** — \`що на сьогодні?\`
• **Тижневий підсумок** — \`підсумуй тиждень\`
• **Ціль** — \`хочу схуднути на 5 кг за 2 місяці\`

💡 Просто пиши звичайною мовою — я зрозумію!`;
