# Playbook: Add API Endpoint

**Trigger:** "Додати новий endpoint в apps/server" / нова API-функціональність / розширення REST API.

---

## Steps

### 1. Створити handler

Створити або оновити handler у `apps/server/src/modules/<module>/`:

```ts
// apps/server/src/modules/<module>/http/<endpoint>.ts
import { z } from "zod";
import type { Request, Response } from "express";

const QuerySchema = z.object({
  // валідація query params
});

export async function myEndpointHandler(req: Request, res: Response) {
  const query = QuerySchema.parse(req.query);
  // бізнес-логіка
  res.json({ data: result });
}
```

Правила:

- Використовувати **zod** для валідації (не ручний `req.body.X`).
- Error handling через `asyncHandler` + typed errors (`ExternalServiceError`, `ValidationError`).
- Bigint→number coercion у response serializer (AGENTS.md rule #1).

### 2. Додати zod-schema

Якщо endpoint приймає body або query params — створити або оновити schema в `http/schemas.ts`:

```ts
export const MyEndpointBodySchema = z.object({
  field: z.string(),
  count: z.number().int().positive(),
});
```

### 3. Зареєструвати route

Додати route у відповідний router файл:

```ts
router.get("/api/<module>/<endpoint>", asyncHandler(myEndpointHandler));
```

### 4. Оновити типи в `packages/api-client`

Додати endpoint у `packages/api-client/src/endpoints/<module>.ts` (AGENTS.md rule #3):

```ts
export async function myEndpoint(params: MyParams): Promise<MyResponse> {
  return httpClient.get("/api/<module>/<endpoint>", { params });
}
```

Типи request і response мають збігатися з серверним handler-ом.

### 5. Тести

```bash
# Unit-тест для handler-а
pnpm --filter @sergeant/server exec vitest run apps/server/src/modules/<module>/

# Перевірити що zod відхиляє невалідний input
# Перевірити bigint coercion у snapshot-тесті (якщо є DB)
```

### 6. Prometheus label (якщо потрібно)

Якщо endpoint потребує окремого моніторингу — перевірити що `path` label коректно групується в `http_requests_total` метриці.

### 7. Створити PR

- Branch: `devin/<unix-ts>-feat-<module>-<endpoint>`
- Commit: `feat(server): add <method> /api/<module>/<endpoint>`
- PR description: що робить endpoint, request/response shape, які клієнти його використовують.

---

## Verification

- [ ] `pnpm lint` — green
- [ ] `pnpm typecheck` — green
- [ ] Server тести — green
- [ ] Zod-schema відхиляє невалідний payload
- [ ] Bigint→number coercion у serializer (rule #1)
- [ ] Типи в `packages/api-client` оновлені (rule #3)
- [ ] Endpoint доступний через `curl` або Playwright E2E

## Notes

- Express 4 з `asyncHandler` wrapper для async route handlers.
- Structured logging через Pino — кожен request має `requestId` в ALS context.
- Якщо endpoint потребує нової DB-таблиці — спочатку [add-sql-migration.md](add-sql-migration.md).
- Auth через Better Auth — перевірити middleware якщо endpoint потребує авторизації.

## See also

- [add-sql-migration.md](add-sql-migration.md) — якщо потрібна міграція БД
- [backend-tech-debt.md](../backend-tech-debt.md) — конвенції серверного коду
- [AGENTS.md](../../AGENTS.md) — rule #1 (bigint), rule #3 (API contract)
- [api-v1.md](../api-v1.md) — документація API
