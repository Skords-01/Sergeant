# Finyk HubChat Tools — `find_transaction` + `batch_categorize`

## Контекст

PR 5 додає два Фінік tools у HubChat. Сервер лише описує tools для Anthropic, а side effects виконуються на клієнті через `executeAction`, тому перша версія працює з локальними Finyk даними (`finyk_manual_expenses_v1`, `finyk_tx_cache`, `finyk_tx_cats`, hidden ids і transaction context, який уже є у клієнта).

## Goals

- `find_transaction`: read-only пошук транзакцій за текстом, сумою і датами, щоб користувач міг сказати «знайди покупку в АТБ».
- `batch_categorize`: масово змінити категорію matched транзакцій за pattern/filter-ами.
- `batch_categorize` має безпечний default `dry_run: true`, щоб спершу показати preview без запису.
- `batch_categorize` позначається як risky action у HubChat card UI.

## Non-goals

- Не робимо server-side DB search у цьому PR.
- Не змінюємо Finyk storage schema.
- Не додаємо confirmation modal; v1 покладається на `dry_run` + risky badge.

## UX/API shape

### `find_transaction`

Input:

- `query?: string` — merchant/description/category substring.
- `amount?: number` + `amount_tolerance?: number` — пошук за сумою у грн.
- `date_from?: string`, `date_to?: string` — `YYYY-MM-DD`.
- `limit?: number` — default 5, max 10.

Output: короткий `tool_result` зі знайденими `id`, датою, сумою, описом і категорією.

### `batch_categorize`

Input:

- `pattern: string` — текстовий matcher по description/merchant/category/id.
- `category_id: string` — цільова категорія з `[Категорії]`.
- `dry_run?: boolean` — default `true`.
- Optional filters: `amount`, `amount_tolerance`, `date_from`, `date_to`, `limit`.

Behavior:

- У `dry_run` повертає preview і не пише в localStorage.
- Якщо `dry_run === false`, записує `finyk_tx_cats[tx_id] = category_id` для matched ids.
- Якщо match-ів немає або `category_id` порожній — повертає informative string без запису.

## Implementation touchpoints

- Server definitions: `apps/server/src/modules/chat/toolDefs/finyk.ts`.
- Prompt listing: `apps/server/src/modules/chat/toolDefs/systemPrompt.ts`.
- Client action types: `apps/web/src/core/lib/chatActions/types.ts`.
- Client handlers: `apps/web/src/core/lib/chatActions/finykActions.ts`.
- Cards/risky marker: `apps/web/src/core/lib/hubChatActionCards.ts`.
- Tests: `hubChatActionsExtended.test.ts`, `hubChatActionCards.test.ts`.

## Open constraint

Mono/server-backed transactions are only batch-editable when their ids are present in the client's currently available Finyk context/local data. Full server-side historical search should be a separate PR if needed.
