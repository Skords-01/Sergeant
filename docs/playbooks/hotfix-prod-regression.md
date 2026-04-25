# Playbook: Hotfix Production Regression

**Trigger:** "Прод впав" / користувачі скаржаться / HTTP 500 на `/health` / Sentry alert / Railway logs показують panic.

---

## Steps

### 1. Підтвердити симптом

```bash
# Перевірити health endpoint
curl -sS https://<prod-domain>/health | jq .

# Railway logs (останні 100 рядків)
railway logs --tail 100

# Sentry (якщо налаштовано) — відкрити dashboard, знайти останній unresolved issue
```

Зафіксувати: що саме зламалось, коли почалось, кого стосується (всі / конкретний endpoint / один юзер).

### 2. Локалізувати причину

```bash
# Які коміти потрапили в прод з моменту коли все працювало?
git log --oneline main~10..main

# Пошук по логам / стектрейсах
grep -rn "<error_keyword>" apps/server/src/
```

Визначити конкретний коміт або файл що викликав регресію.

### 3. Створити hotfix-гілку від `main`

```bash
git checkout main && git pull origin main
git checkout -b devin/<unix-ts>-hotfix-<short-desc>
```

- Гілка **завжди** від `main` (не від feature-branch).
- Ніяких `--force-push` (AGENTS.md rule #6).

### 4. Мінімальний фікс

- Тільки те що потрібно щоб прибрати регресію. Ніяких "while we're here" рефакторингів.
- Conventional commit: `fix(<scope>): <що саме виправлено>` (AGENTS.md rule #5).
- Якщо фікс стосується DB serializer — перевірити bigint→number coercion (AGENTS.md rule #1).

### 5. Написати тест що відтворює регресію

```bash
# Створити або оновити тест що падає БЕЗ фіксу і проходить З фіксом
pnpm --filter <package> exec vitest run <path-to-test>
```

Тест **обов'язковий** — без нього PR не мерджити. Тест має:

- Відтворювати точний сценарій що зламався.
- Проходити з фіксом.
- Падати якщо фікс відкатити (red-green перевірка).

### 6. Fast-track PR review

```bash
pnpm lint       # має бути зеленим
pnpm typecheck  # має бути зеленим
```

- PR title: `fix(<scope>): hotfix — <short description>`
- PR description: що зламалось, root cause, як відтворити, що фікснуто.
- Label: `hotfix` (якщо є).
- Reviewer: мейнтейнер або on-call.

### 7. Deploy через Railway

Після merge в `main`:

- Railway автоматично деплоїть (або тригернути вручну через Railway dashboard).
- Pre-deploy: `pnpm db:migrate` (якщо були міграції).
- Перевірити `/health` endpoint після деплою.

```bash
curl -sS https://<prod-domain>/health | jq .
```

### 8. Post-mortem note

Створити `docs/postmortems/YYYY-MM-DD-<short-desc>.md` з:

- **Що сталось** — симптоми з кроку 1.
- **Root cause** — що знайшли у кроці 2.
- **Fix** — посилання на PR.
- **Timeline** — коли зламалось → коли помітили → коли пофіксили.
- **Prevention** — який тест / CI check / lint rule запобіг би цьому.

---

## Verification

- [ ] `/health` повертає 200 на проді
- [ ] Sentry issue resolved (якщо був)
- [ ] `pnpm lint` — green
- [ ] `pnpm typecheck` — green
- [ ] Тест що відтворює регресію — green
- [ ] Post-mortem note створено

## Notes

- **Ніяких force push** до `main` — AGENTS.md rule #6.
- **Conventional commits** — `fix(scope): ...` — AGENTS.md rule #5.
- **Husky pre-commit** — не skip-увати (`--no-verify` заборонено) — AGENTS.md rule #7.
- Flaky mobile-тести (`OnboardingWizard`, `WeeklyDigestFooter`, `HubSettingsPage`) не блокують merge — AGENTS.md.
- Якщо регресія в DB serializer — обов'язково перевірити bigint→number coercion ([#708](https://github.com/Skords-01/Sergeant/issues/708)).

## See also

- [AGENTS.md](../../AGENTS.md) — hard rules
- [monobank-webhook-migration.md](../monobank-webhook-migration.md) — якщо регресія пов'язана з Monobank webhook pipeline
- [cleanup-dead-code.md](cleanup-dead-code.md) — якщо hotfix виявить мертвий код що заважав
