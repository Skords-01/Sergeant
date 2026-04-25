# Playbooks

Repeatable step-by-step recipes for common tasks in the Sergeant monorepo.
Each playbook is a checklist that **AI agents and human developers** can follow to reduce variance and avoid missed steps.

> **Origin:** `docs/ai-coding-improvements.md` Block 2.
> **Format:** Option A — markdown files in-repo. If the team later wants GUI-driven execution, these can be imported into Devin webapp as `playbook-<uuid>`.

## Available Playbooks

| Playbook                                                                       | Trigger                                                                           |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| [add-feature-flag.md](add-feature-flag.md)                                     | "Put feature X behind a flag" / new experimental feature                          |
| [cleanup-dead-code.md](cleanup-dead-code.md)                                   | "Remove X and all its usages" / dead code cleanup                                 |
| [hotfix-prod-regression.md](hotfix-prod-regression.md)                         | "Прод впав" / HTTP 500 на `/health` / Sentry alert / production incident response |
| [add-monobank-event-handler.md](add-monobank-event-handler.md)                 | "Треба обробити нову подію X від Monobank" / новий тип webhook event              |
| [bump-dep-safely.md](bump-dep-safely.md)                                       | "Оновити X до версії Y" / Renovate major-bump / security advisory                 |
| [add-sql-migration.md](add-sql-migration.md)                                   | "Додати нове поле / таблицю в БД" / зміна схеми PostgreSQL                        |
| [rotate-secrets.md](rotate-secrets.md)                                         | "Secret leaked" / планова ротація / security audit                                |
| [add-new-page-route.md](add-new-page-route.md)                                 | "Додати нову сторінку в apps/web" / новий route для SPA                           |
| [migrate-localstorage-to-typedstore.md](migrate-localstorage-to-typedstore.md) | Мігрувати файл з прямого localStorage на typedStore (tech debt #2)                |
| [fix-exhaustive-deps.md](fix-exhaustive-deps.md)                               | Виправити exhaustive-deps warnings / React hooks cleanup                          |
| [port-web-screen-to-mobile.md](port-web-screen-to-mobile.md)                   | "Перенести екран X з apps/web в apps/mobile" / React Native міграція              |
| [add-api-endpoint.md](add-api-endpoint.md)                                     | "Додати новий endpoint в apps/server" / нова API-функціональність                 |
| [onboard-external-api.md](onboard-external-api.md)                             | "Інтегрувати нову зовнішню API" / новий third-party сервіс                        |
| [investigate-alert.md](investigate-alert.md)                                   | Prometheus alert спрацював / Sentry alert / деградація `/health`                  |
| [add-hubchat-tool.md](add-hubchat-tool.md)                                     | «Дай асистенту нову дію X» / новий tool-call для Anthropic-асистента              |
| [add-react-query-hook.md](add-react-query-hook.md)                             | Новий `useQuery` / `useMutation` у `apps/web` / нова server-state дата            |
| [add-onboarding-step.md](add-onboarding-step.md)                               | «Додай новий крок в онбординг» / новий FTUX-етап для нових юзерів                 |
| [tune-system-prompt.md](tune-system-prompt.md)                                 | «AI відповідає не так як треба» / зміна тону / правил tool-calling                |
| [stabilize-flaky-test.md](stabilize-flaky-test.md)                             | «Тест X падає 1 з 5 разів» / тест у AGENTS.md flaky-list                          |

## How to Use

1. **AI agents:** When a task matches a playbook trigger, read the playbook and follow it step-by-step. Confirm completion of each step before moving to the next.
2. **Humans:** Use as a PR checklist — copy the steps into your PR description or mentally tick them off.
3. **Adding a new playbook:** Create a new `.md` file in this folder, add a row to the table above, and follow the same format (trigger, steps, verification, notes).
