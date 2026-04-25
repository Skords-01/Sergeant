# Playbook: Add HubChat Tool

**Trigger:** «Дай асистенту нову дію X» / «Додай tool в HubChat» / новий tool-call для Anthropic-асистента (наприклад `log_water`, `log_set`, `mark_habit_done`).

---

## Контекст

HubChat tools визначаються **на сервері** (`apps/server/src/modules/chat/toolDefs/<domain>.ts`), але виконуються **на клієнті** (`apps/web/src/core/lib/chatActions/<domain>Actions.ts`). Сервер — тонкий пас-зрізу до Anthropic API. Тому новий tool — це 3-4 синхронні правки в різних файлах. Дивись «Architecture: AI tool execution path» в `AGENTS.md`.

---

## Steps

### 1. Tool definition (server)

Додати запис у `apps/server/src/modules/chat/toolDefs/<domain>.ts`. Доступні домени: `finyk`, `fizruk`, `nutrition`, `routine`, `crossModule`, `utility`, `memory`. Якщо tool належить до конкретного модуля — клади у цей файл; крос-модульні (`morning_briefing`, `weekly_summary`) — у `crossModule.ts`.

```ts
// apps/server/src/modules/chat/toolDefs/nutrition.ts
{
  name: "log_water",
  description:
    "Залогувати випиту воду. Викликай коли користувач каже скільки води випив.",
  input_schema: {
    type: "object",
    properties: {
      amount_ml: {
        type: "number",
        description: "Кількість мілілітрів",
      },
      time: {
        type: "string",
        description: "Час прийому ISO 8601 (опціонально, default — зараз)",
      },
    },
    required: ["amount_ml"],
  },
}
```

Description пишемо **українською** і **імперативно** (Anthropic вибирає tool за descriptions). Не «Tool that logs water», а «Залогувати випиту воду. Викликай коли...».

### 2. Action type (client)

Додати typed action у `apps/web/src/core/lib/chatActions/types.ts`:

```ts
export interface LogWaterAction {
  name: "log_water";
  input: { amount_ml: number; time?: string };
}

export type ChatAction =
  | ...
  | LogWaterAction;
```

`name` має точно збігатися з `name` з tool definition.

### 3. Action handler (client)

Додати case у відповідний `chatActions/<domain>Actions.ts`:

```ts
// apps/web/src/core/lib/chatActions/nutritionActions.ts
case "log_water": {
  const { amount_ml, time } = (action as LogWaterAction).input;
  const log = ls<WaterEntry[]>("nutrition_water_log_v1", []);
  log.push({
    id: crypto.randomUUID(),
    amount_ml,
    ts: time ? Date.parse(time) : Date.now(),
  });
  lsSet("nutrition_water_log_v1", log);
  return `Залоговано ${amount_ml} мл води`;
}
```

Правила handler-а:

- **Повертає рядок** — це `tool_result`, який модель побачить наступним кроком. Має бути коротким і інформативним.
- При помилці — викидай `Error`; `executeAction` обгортає в `Помилка виконання: ...`.
- Запис у `localStorage` через `ls`/`lsSet` helper-и (НЕ `localStorage.setItem` напряму).
- Якщо tool пише в API — використовуй `@sergeant/api-client`, не `fetch`.

### 4. Action card (опціонально, але майже завжди)

Якщо tool — user-visible action (тобто не `morning_briefing`-style summary), додай мапер у `apps/web/src/core/lib/hubChatActionCards.ts`:

```ts
case "log_water": {
  const amount = typeof input.amount_ml === "number" ? input.amount_ml : 0;
  return {
    icon: "droplet",
    title: titleFor(name, status), // → "Воду залоговано"
    summary: `${amount} мл`,
  };
}
```

І додай case у `titleFor`:

```ts
case "log_water":
  return `Воду залоговано${failedSuffix}`;
```

**Обов'язково** додавай `${failedSuffix}` — це гарантує, що при `failed`-статусі заголовок матиме `— не вийшло` замість success-tone тексту (див. fix у [#754](https://github.com/Skords-01/Sergeant/pull/754)).

### 5. Risky tool (якщо застосовно)

Якщо tool **деструктивний** (видалення, забути факт, масовий імпорт) — додай у `RISKY_TOOLS` в `hubChatActionCards.ts`:

```ts
const RISKY_TOOLS: ReadonlySet<string> = new Set([
  "delete_transaction",
  "hide_transaction",
  "forget",
  "archive_habit",
  "import_monobank_range",
  // "your_destructive_tool",
]);
```

Це автоматично додає лейбл «Критична дія» в action card і warning-стиль.

### 6. Quick action chip (опціонально)

Якщо tool корисно мати під одне натискання — додай у registry `apps/web/src/core/lib/hubChatQuickActions.ts`:

```ts
{
  id: "log-water",
  module: "nutrition",
  label: "Залогувати воду",
  shortLabel: "Вода",
  icon: "droplet",
  prompt: "Залогуй: ", // закінчується на ": " → prefill flow
  description: "Швидкий запис склянки води.",
  priority: 30,
  requiresOnline: true,
  keywords: ["вода", "пиття"],
}
```

Якщо `prompt` закінчується на `: ` — натискання вставляє текст у input замість одразу відправляти (для випадків, де треба число).

### 7. Тести

Як мінімум:

- **Tool def**: можна не тестувати окремо — Anthropic перевіряє при call.
- **Handler**: unit-test у `chatActions/<domain>Actions.test.ts` — щоб успіх зберігав у localStorage і повертав очікуваний рядок.
- **Action card** (якщо додав): додай у `hubChatActionCards.test.ts` — перевір title + status + summary, зокрема `failed` → `— не вийшло`.
- **Quick action** (якщо додав): додай у `hubChatQuickActions.test.ts` — перевір що input у `pickTopQuickActions` для відповідного modul-у повертає його.

```bash
pnpm --filter @sergeant/web exec vitest run src/core/lib/chatActions
pnpm --filter @sergeant/web exec vitest run src/core/lib/hubChatActionCards
pnpm --filter @sergeant/web exec vitest run src/core/lib/hubChatQuickActions
```

### 8. PR

Branch: `devin/<unix-ts>-feat-chat-<tool-name>`. Conventional commit:

```
feat(web): add HubChat tool log_water

- toolDef in chat/toolDefs/nutrition.ts
- handler in chatActions/nutritionActions.ts
- action card mapper + titleFor case
- quick action chip (prefill flow)
- 4 unit tests
```

---

## Verification

- [ ] Tool def додано у відповідний `toolDefs/<domain>.ts`.
- [ ] Action type у `chatActions/types.ts`.
- [ ] Handler у `chatActions/<domain>Actions.ts`, повертає informative string.
- [ ] Якщо user-visible — action card у `hubChatActionCards.ts` з `${failedSuffix}` в title.
- [ ] Якщо destructive — додано у `RISKY_TOOLS`.
- [ ] Якщо часта — quick action chip у `hubChatQuickActions.ts`.
- [ ] Unit tests для handler + (опційно) action card + quick action.
- [ ] `pnpm lint` + `pnpm typecheck` — green.
- [ ] Smoke-перевірка: відкрити HubChat у dev → попросити модель зробити дію → побачити action card.

## Notes

- **DB writes ніколи у `chat.ts`**. Tool handler пише або у localStorage, або через `@sergeant/api-client` → серверні endpoint-и (звичайні Express routes), які пишуть у БД.
- Якщо tool потребує **серверної логіки** (наприклад агрегація з БД) — спочатку зроби API endpoint через `add-api-endpoint.md`, потім handler tool-а викликає його через `api-client`.
- System prompt (контекст модулі, instruction tone) — НЕ міняй у цьому playbook. Для цього є окремий `tune-system-prompt.md`.
- Tool name — **snake_case** (Anthropic convention), action type — `PascalCaseAction`.

## See also

- [tune-system-prompt.md](tune-system-prompt.md) — як міняти системний промпт без поломки tool-calling
- [add-api-endpoint.md](add-api-endpoint.md) — якщо tool пише у БД
- [AGENTS.md](../../AGENTS.md) — секція «Architecture: AI tool execution path»
- `apps/web/src/core/lib/hubChatQuickActions.ts` — registry з прикладами
- `docs/superpowers/specs/2026-04-24-assistant-quick-actions-v1-design.md` — дизайн quick actions v1
