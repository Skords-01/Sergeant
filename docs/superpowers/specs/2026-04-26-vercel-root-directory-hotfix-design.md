# Hotfix Vercel Root Directory

## Проблема

Production `sergeant.vercel.app` повертає Vercel `404: NOT_FOUND`. Vercel project має Root Directory `apps/web`, а поточний Vercel config лежить у корені репозиторію. Project config читається з project root directory, тому root-level `vercel.json` може не застосовуватись до `apps/web` project.

## Рішення

Додати `apps/web/vercel.json` з тими самими production web settings:

- install через pinned pnpm 9.15.1 з monorepo root;
- build `@sergeant/web`;
- лишити `outputDirectory` як `../server/dist`, що відповідає `apps/web/vite.config.js`;
- зберегти static headers і SPA rewrites, включно з `.well-known` exclusions для app links.

Не змінювати Vite `outDir` у цьому hotfix. Це зачепило б size-limit paths, docs і наявні server/static assumptions.

## Перевірка

- `pnpm --filter @sergeant/web build`
- `pnpm --filter @sergeant/web exec size-limit`
- PR CI і Vercel preview/prod deployment checks

## Self-review

- Немає placeholders.
- Scope обмежений Vercel project configuration.
- Збережено наявний build output contract: `apps/server/dist`.
