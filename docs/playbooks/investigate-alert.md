# Playbook: Investigate Alert

**Trigger:** Prometheus alert спрацював / Sentry повідомлення / підозрілі 5xx у логах / деградація `/health`.

---

## Steps

### 1. Визначити тип алерту

Відкрити `docs/observability/runbook.md` і знайти відповідний розділ:

| Алерт                     | Що горить                                     |
| ------------------------- | --------------------------------------------- |
| `HttpErrorBudgetBurn`     | Сплеск 5xx responses                          |
| `DbPoolSaturation`        | DB connection pool заповнений                 |
| `AiQuotaBudgetBurn`       | AI-запити перевищують квоту                   |
| `PushDeliveryDegradation` | Push-нотифікації не доставляються             |
| `ExternalApiCircuitOpen`  | Circuit breaker відкрився для зовнішнього API |
| `HighMemoryUsage`         | Memory leak або spike                         |

### 2. Перевірити /metrics

```bash
# Prometheus метрики
curl -H "Authorization: Bearer $METRICS_TOKEN" https://<prod>/metrics

# Ключові метрики для 5xx:
# http_requests_total{status=~"5.."}
# app_errors_total{kind,status,code,module}
# external_http_requests_total{upstream,outcome}
```

### 3. Перевірити Pino логи

```bash
# Railway logs (JSON, Pino format)
railway logs --tail 200 | jq 'select(.level >= 50)'

# Фільтрувати по module
railway logs --tail 200 | jq 'select(.module == "<module>")'

# Шукати конкретну помилку
railway logs --tail 500 | jq 'select(.err != null) | {time, module, msg, err: .err.message}'
```

Кожен лог-запис має ALS-контекст: `requestId`, `userId`, `module`.

### 4. Класифікувати root cause

| Категорія             | Ознаки                                        | Дії                                                      |
| --------------------- | --------------------------------------------- | -------------------------------------------------------- |
| DB saturated          | `db_pool_waiting` високий, повільні queries   | Перевірити slow queries, можливо потрібен індекс         |
| External API down     | `circuit_open` outcome, timeouts              | Нічого не робити — circuit breaker захищає; чекати       |
| Code bug (regression) | Конкретний path + stack trace                 | → [hotfix-prod-regression.md](hotfix-prod-regression.md) |
| AI quota exceeded     | `ai_requests_total{outcome="quota_exceeded"}` | Збільшити ліміт або оптимізувати prompts                 |
| Memory leak           | Зростаючий RSS, OOMKilled у Railway           | Профілювати з `--inspect`, знайти leak                   |
| Rate limit (Monobank) | 429 у логах для mono upstream                 | Очікувано — rate limit 1 req/60s/token                   |

### 5. Виправити або ескалувати

- **Якщо code bug** → слідуй [hotfix-prod-regression.md](hotfix-prod-regression.md).
- **Якщо external API** → зачекай, circuit breaker автоматично відновиться через `resetTimeout` (30s).
- **Якщо DB** → додай індекс або оптимізуй query → [add-sql-migration.md](add-sql-migration.md).
- **Якщо незрозуміло** → ескалуй до мейнтейнера з зібраними даними.

### 6. Документувати

Якщо інцидент значний (downtime > 5 хв, data loss, user impact):

- Створити `docs/postmortems/YYYY-MM-DD-<short-desc>.md`
- Timeline: алерт → виявлено → пофіксено → verified
- Root cause
- Prevention: який тест / моніторинг запобіг би

---

## Verification

- [ ] Root cause визначено
- [ ] `/health` повертає 200
- [ ] Алерт resolved (метрики повернулись до норми)
- [ ] Фікс задеплоєно (якщо code bug)
- [ ] Post-mortem створено (якщо значний інцидент)

## Notes

- **Не панікуй** — circuit breaker і retry захищають від більшості transient failures.
- Pino логи — JSON у stdout. Використовуй `jq` для фільтрації.
- `METRICS_TOKEN` потрібен для доступу до `/metrics` endpoint.
- Sentry ловить `fatal`/`error` рівні включно з `err.cause` chain.
- Flaky external APIs (Monobank, Anthropic) — очікувана поведінка, circuit breaker повинен справлятись.

## See also

- [observability/runbook.md](../observability/runbook.md) — повний runbook для кожного типу алерту
- [observability/SLO.md](../observability/SLO.md) — SLO визначення та бюджети
- [observability/dashboards.md](../observability/dashboards.md) — Grafana dashboards
- [hotfix-prod-regression.md](hotfix-prod-regression.md) — якщо root cause = code bug
- [AGENTS.md](../../AGENTS.md) — deployment та health endpoint
