# Playbook: Rotate Secrets

**Trigger:** "Secret leaked" / планова ротація / security audit / підозріла активність.

---

## Steps

### 1. Оцінити scope витоку

- Який secret скомпрометовано?
- Де він використовується? (Railway env, CI secrets, `.env` файли)
- Чи є ознаки зловживання? (логи, Sentry, незвичайні запити)

### 2. Згенерувати новий secret

```bash
# Для загальних secrets (BETTER_AUTH_SECRET, etc.)
openssl rand -hex 32

# Для VAPID keys
pnpm exec web-push generate-vapid-keys

# Для Monobank webhook secret (per-user, зберігається в DB)
# Це server-side — потребує код-зміну якщо ротація всіх юзерів
```

### 3. Оновити secret у середовищах

**Railway (Production):**

1. Відкрити Railway dashboard → Service → Variables
2. Оновити значення змінної
3. Railway автоматично перезапустить сервіс

**GitHub Actions (CI):**

1. Settings → Secrets and variables → Actions
2. Оновити відповідний secret

**Локальна розробка:**

1. Оновити `.env` файл (НЕ комітити!)
2. Оновити `.env.example` якщо формат secret-а змінився

### 4. Перевірити `/health` endpoint

```bash
# Після того як Railway передеплоїть
curl -sS https://<prod-domain>/health | jq .
```

Переконатись що сервіс стартанув з новим secret-ом без помилок.

### 5. Інвалідувати старий secret

- Якщо це API key зовнішнього сервісу — revoke через dashboard провайдера (Anthropic, Resend, Sentry тощо).
- Якщо це `BETTER_AUTH_SECRET` — всі існуючі сесії стануть невалідними (юзерам треба буде re-login).
- Якщо це Monobank `MONO_TOKEN_ENC_KEY` — потрібна re-encryption всіх збережених токенів.

### 6. Post-mortem (якщо leak)

Якщо secret витік (а не планова ротація):

- Створити `docs/postmortems/YYYY-MM-DD-secret-rotation.md`
- Описати: що витекло, як, timeline, impact, prevention.

---

## Verification

- [ ] Новий secret встановлено у всіх середовищах (Railway, CI, local)
- [ ] `/health` — 200
- [ ] Старий secret інвалідовано
- [ ] `.env.example` оновлено (якщо формат змінився)
- [ ] Логи не містять нових помилок автентифікації
- [ ] Post-mortem створено (якщо leak)

## Notes

- **НІКОЛИ** не комітити secrets у git (навіть тимчасово).
- `BETTER_AUTH_SECRET` ротація = всі сесії інвалідуються. Робити в low-traffic час.
- `MONO_TOKEN_ENC_KEY` ротація — найскладніша, потребує re-encrypt всіх `mono_connection.token_ciphertext`. Окремий migration script.
- Railway Variables з типом «Reference» (`${{ Postgres.DATABASE_URL }}`) — змінюються автоматично при зміні DB credentials.

## See also

- [railway-vercel.md](../railway-vercel.md) — список env vars для Railway
- [AGENTS.md](../../AGENTS.md) — ніколи не комітити credentials
- [hotfix-prod-regression.md](hotfix-prod-regression.md) — якщо ротація зламала прод
