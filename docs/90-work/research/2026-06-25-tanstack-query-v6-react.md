# TanStack Query v6 — чи мігрувати apps/web

> **Last validated:** 2026-06-25 by @claude. **Next review:** 2026-09-23.
> **Status:** Active

## Питання

Чи варто оновлювати `apps/web` із TanStack (React) Query v5 на v6 — які breaking changes, обсяг роботи й ризики, з огляду на наші централізовані RQ key-фабрики (`apps/web/src/shared/lib/api/queryKeys.ts`, Hard Rule #2) і ~80 файлів-споживачів?

## Висновок

**Мігрувати нікуди — для React версії v6 не існує.** Станом на 2026-06-25 остання `@tanstack/react-query` — `5.101.1` (опублікована 2026-06-23), у реєстрі **жодної** 6.x. Мажор v6 випущено лише для **Svelte** (`@tanstack/svelte-query` `6.1.35`) і він зав'язаний на Svelte 5 runes/signals — до React не стосується. Ми вже на актуальному v5 (`^5.99.0`), тож дій не потрібно. Статті в дусі «TanStack Query v6 breaking changes» для React-аудиторії — або про Svelte, або спекулятивні; покладатися на них не можна.

Рекомендація: лишатися на v5, тримати patch/minor у звичайному deps-bump-потоці. Перепровірити це питання, коли/якщо React Query анонсує v6 (трекати через offiційний changelog, не блог-пости).

## Деталі

- **React Query досі v5.** npm registry для `@tanstack/react-query`: `dist-tags.latest = 5.101.1`, 520 версій, фільтр `6.*` → порожньо. Остання публікація `2026-06-23` — пакет активно підтримується саме на v5. (Джерело: registry API, нижче.)
- **v6 = Svelte-only.** `@tanstack/svelte-query` `dist-tags.latest = 6.1.35`. Офіційний гайд міграції `v5 → v6` лежить у docs під `framework/svelte/...`, тоді як для React офіційний існує лише `migrating-to-v5`. Зміни v6 (Svelte): функції адаптера приймають опції як «thunk» (`() => options`) для реактивності; потрібен Svelte ≥ 5.25.0. Для React це нерелевантно.
- **Наш стан.** `apps/web/package.json`: `@tanstack/react-query@^5.99.0` + `@tanstack/react-query-persist-client@^5.99.2`; ~80 файлів у `apps/web/src` імпортують пакет; key-фабрики (`finykKeys`, `nutritionKeys`, …) у `apps/web/src/shared/lib/api/queryKeys.ts` (157 рядків). Тобто гіпотетична мажор-міграція була б широкою (80 файлів + контракт RQ-ключів), але зараз вона безпредметна.
- **Що НЕ перевіряли.** Не аналізували v5 minor-changelog на предмет дрібних deprecation усередині 5.99→5.101 — це окреме, дешевше питання для звичайного deps-bump.

## Джерела

- npm registry API `registry.npmjs.org/@tanstack/react-query` — `latest=5.101.1`, 0 версій 6.x, publish `2026-06-23` (звірено напряму, найавторитетніше).
- npm registry API `registry.npmjs.org/@tanstack/svelte-query` — `latest=6.1.35` (v6 існує лише для Svelte).
- [TanStack Query — migrating-to-v5 (React docs)](https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5) — для React офіційний гайд лише до v5.
- [TanStack/query releases (GitHub)](https://github.com/tanstack/query/releases).
- `apps/web/package.json`, `apps/web/src/shared/lib/api/queryKeys.ts` — наш поточний стан (репо-контекст через grep).
- ⚠️ low-confidence / misleading: [Medium «TanStack Query v6: Breaking Changes»](https://medium.com/better-dev-nextjs-react/tanstack-query-v6-breaking-changes-that-actually-improve-your-app-bec0d8e4ed1b) — заголовок вводить в оману для React; не використовувати як підставу для рішень.

## Невідоме / наступні кроки

- Дата React Query v6 невідома — офіційного анонсу немає. Перепровірити при появі `6.x` у `dist-tags` `@tanstack/react-query`.
- Окреме дешеве питання (не блокер): чи є корисні deprecation-фікси в межах v5 `5.99 → 5.101` під час наступного deps-bump.
