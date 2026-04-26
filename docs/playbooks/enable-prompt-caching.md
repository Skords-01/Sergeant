# Playbook: Enable Anthropic Prompt Caching

**Trigger:** «Зменшити cost Anthropic» / «Anthropic API занадто дорогий» / `aiTokensTotal{kind="prompt"}` росте лінійно з трафіком, бо `SYSTEM_PREFIX` повторюється на кожному запиті.

---

## Контекст

`SYSTEM_PREFIX` (`apps/server/src/modules/chat/toolDefs/systemPrompt.ts`) — стабільний на всіх запитах: змінюється тільки appended `context` блок з даними юзера. Anthropic prompt caching дозволяє позначити стабільну частину `cache_control: { type: "ephemeral" }`; перший запит «запишеться» у кеш (cost трохи вищий — `cache_creation_input_tokens`), наступні протягом ~5 хв читатимуть з кешу за ~10% від звичайної ціни (`cache_read_input_tokens`).

Деталі — `AGENTS.md` → _SYSTEM_PREFIX is a prompt-cache candidate_. Цей playbook — конкретний rollout.

**Передумови:**

- Модель підтримує prompt caching. На момент написання — всі актуальні Claude (3.5 Sonnet, Sonnet 4 і `claude-sonnet-4-6`, який зараз у `chat.ts`) підтримують.
- Будь-який `model` upgrade пізніше — перевір release notes Anthropic; якщо нова модель не підтримує — feature виродиться у звичайний non-cached запит без помилки.
- `SYSTEM_PREFIX` уже стабільний (не міксує per-user дані). Якщо ти збираєшся рефакторити промпт у тому ж PR — спочатку зроби prompt caching, потім окремим PR — рефактор. Інакше cache miss-и за перші 5 хв після деплою накладуться.

---

## Steps

### 1. Перетвори `system` з string на масив із `cache_control`

`apps/server/src/modules/chat.ts` зараз шле `system: SYSTEM_PREFIX + context` (рядок ~115 для tool-result continuation; рядок ~171 для першого запиту). Перетвори на масив із двома `text` блоками — кешований префікс і динамічний контекст:

```ts
// chat.ts (обидва місця, де передається system)
const payload = {
  model: "claude-sonnet-4-6",
  max_tokens: 600,
  system: [
    {
      type: "text" as const,
      text: SYSTEM_PREFIX,
      cache_control: { type: "ephemeral" as const },
    },
    {
      type: "text" as const,
      text: context, // per-user dynamic data — НЕ кешується
    },
  ],
  tools: TOOLS,
  messages: cleaned,
};
```

**Чому два блоки, а не один:** `cache_control` помічає границю кешу. Все ДО і ВКЛЮЧНО з блоком `cache_control` йде в кеш; що після — динамічна частина. Якщо лишити одну строку `SYSTEM_PREFIX + context`, то `context` теж потрапить у кеш-ключ і кожен різний user отруїть свій slot.

Те саме застосуй для tool-result continuation payload (рядок ~115).

### 2. (Опц.) Beta header — лише для старих моделей

На моделях, що офіційно підтримують prompt caching у GA (Sonnet 4-сімейство, 3.5 Sonnet після Sep 2024), beta header **не обов'язковий**. Якщо переходиш на legacy модель або хочеш бути захищеним від drift Anthropic — додай у `apps/server/src/lib/anthropic.ts` рядок ~166 і ~245:

```ts
headers: {
  "Content-Type": "application/json",
  "x-api-key": apiKey,
  "anthropic-version": "2023-06-01",
  // NOTE: Prompt caching у GA для актуальних моделей; header додаємо
  // як страхування для legacy моделей у майбутніх експериментах.
  "anthropic-beta": "prompt-caching-2024-07-31",
},
```

Якщо пропускаєш цей крок — нічого не зламається на актуальних моделях. Прочитай Anthropic release notes перед увімкненням, якщо нова модель додалась.

### 3. Версіонуй `SYSTEM_PREFIX`

Додай константу версії, щоб **навмисні** зміни промпту легко логувати у Prometheus:

```ts
// apps/server/src/modules/chat/toolDefs/systemPrompt.ts
export const SYSTEM_PROMPT_VERSION = "v4";
export const SYSTEM_PREFIX = `Ти персональний асистент …`;
```

Бампай при кожній свідомій зміні `SYSTEM_PREFIX`. Після bump — перші запити кожного юзера будуть cache miss (нова cache key), що очікувано і коротко.

### 4. Метрики `cache_creation` / `cache_read`

`apps/server/src/lib/anthropic.ts` `recordUsage()` сьогодні логує тільки `input_tokens` / `output_tokens`. Після увімкнення кеш-у Anthropic повертає у `usage`:

```ts
interface AnthropicUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}
```

Розшир `recordUsage`:

```ts
if (Number.isFinite(usage.cache_creation_input_tokens)) {
  aiTokensTotal.inc(
    { provider: "anthropic", model, kind: "cache_write" },
    usage.cache_creation_input_tokens,
  );
}
if (Number.isFinite(usage.cache_read_input_tokens)) {
  aiTokensTotal.inc(
    { provider: "anthropic", model, kind: "cache_read" },
    usage.cache_read_input_tokens,
  );
}
```

Те саме застосуй у `recordUsage` для streaming варіанта (`anthropicMessagesStream`).

### 5. Тести

Існуючі тести `apps/server/src/modules/chat.test.ts` мокають Anthropic — структура `system` змінилась з string на масив, тому міг зламатись `expect.objectContaining({ system: expect.stringMatching(…) })`. Онови assertion на:

```ts
expect(fetchMock).toHaveBeenCalledWith(
  expect.anything(),
  expect.objectContaining({
    body: expect.stringContaining('"cache_control":{"type":"ephemeral"}'),
  }),
);
```

Або, безпечніше, парс body з JSON і перевіряй структуру:

```ts
const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
expect(body.system).toEqual([
  { type: "text", text: SYSTEM_PREFIX, cache_control: { type: "ephemeral" } },
  { type: "text", text: expect.stringContaining("[Категорії]") },
]);
```

Запуск:

```bash
pnpm --filter @sergeant/server exec vitest run src/modules/chat
pnpm --filter @sergeant/server exec vitest run src/lib/anthropic
```

### 6. Manual verification у dev

```bash
# 1. Старт сервера з реальним ANTHROPIC_API_KEY (не disabled).
ANTHROPIC_API_KEY=sk-ant-... pnpm --filter @sergeant/server dev

# 2. Перший запит до /api/chat від тестового юзера.
#    У логах logger пише response.usage → шукай cache_creation_input_tokens > 0.

# 3. Другий ідентичний запит протягом ~5 хв.
#    cache_creation_input_tokens → 0 (бо вже у кеші)
#    cache_read_input_tokens > 0 (читає з кешу)
#    input_tokens ~= ~залишок (динамічний context)
```

Якщо у другому запиті `cache_read_input_tokens === 0` — значить `cache_control` не спрацював. Найчастіше: блок з `cache_control` не «співпав» побайтово — наприклад, ти випадково склеїв `SYSTEM_PREFIX` з context-ом всередині кешованого блоку.

### 7. Production rollout

- Деплой → перші ~5 хв cache miss-и для всіх юзерів (що нормально).
- Через 5–15 хв подивись Grafana `aiTokensTotal{kind="cache_read"}` — має лінійно рости.
- Cost: typical 5–10× зниження input-token billing на стабільних запитах.

Якщо `cache_read` лишається на 0 на проді при non-zero `cache_write` — ймовірний `SYSTEM_PROMPT_VERSION` churn (хтось мерджить ще одну зміну промпту, інвалідуючи кеш). Заморозь промпт.

---

## Verification

- [ ] `system` у обох викликах `chat.ts` — масив із двома `text` блоками: cached `SYSTEM_PREFIX` + dynamic `context`.
- [ ] (Якщо застосовно) `anthropic-beta: prompt-caching-2024-07-31` додано і в звичайний, і в стрімовий клієнт.
- [ ] `SYSTEM_PROMPT_VERSION` додано і логічно підвищується з кожною свідомою зміною промпту.
- [ ] `recordUsage` пише `kind: "cache_write"` і `kind: "cache_read"` у `aiTokensTotal`.
- [ ] Dev smoke: два послідовні `/api/chat` дають `cache_creation > 0` (1-й) і `cache_read > 0` (2-й).
- [ ] Тести `chat.test.ts` оновлені під нову структуру `system` і green.
- [ ] PR description містить: token-cost diff (estimate), reference на Anthropic prompt caching docs, Grafana посилання на нові метрики.

## Notes

- **Не міняй `SYSTEM_PREFIX` часто.** Кожна зміна — повний cache invalidation, для всіх активних юзерів. Якщо потрібно подіагностувати tone — кешуй stable prefix і додай експериментальний rider у `context` блок (не у кеш).
- **Tool definitions у `tools` параметрі НЕ кешуються тим самим `cache_control`.** Якщо `TOOLS` теж великий і стабільний — постав окремий `cache_control` всередині `tools` як ще одну точку розриву (Anthropic дозволяє до 4 cache breakpoints на запит). На момент писання `tools.ts` у нас невеликий, тому економія мала; повертайся до цього кроку, якщо `TOOLS` виросте.
- **TTL ephemeral кешу — ~5 хв** з останнього read. Для sparse трафіку (юзер заходить раз на годину) prompt caching не дасть значної економії; має сенс для активних сесій / інтенсивного chat-flow.
- **Cache key чутливий побайтно.** Невидимий whitespace-diff, BOM, нерозривні пробіли — все робить cache miss. Не редагуй `SYSTEM_PREFIX` у редакторі без unicode-aware diff.

## See also

- [tune-system-prompt.md](tune-system-prompt.md) — як міняти `SYSTEM_PREFIX` без поломки tool-calling (виконуй до або в окремому PR від caching rollout)
- [AGENTS.md](../../AGENTS.md) — секції _Architecture: AI tool execution path_ і _SYSTEM_PREFIX is a prompt-cache candidate_
- `apps/server/src/lib/anthropic.ts` — `anthropicMessages` / `anthropicMessagesStream` / `recordUsage`
- `apps/server/src/modules/chat.ts` — обидва payload-и (рядки ~115, ~171)
- Anthropic docs: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
