# Changelog

> **Last validated:** 2026-04-29 by @devin-ai. **Next review:** 2026-07-29.
> **Status:** Active

Усі помітні зміни проєкту документуються тут.

Формат — [Keep a Changelog](https://keepachangelog.com/uk/1.1.0/),
версіювання — [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Автоматизація:** проєкт використовує Conventional Commits + commitlint.
> Наступний крок — підключити автоматичну генерацію changelog
> (наприклад, `changesets` або `conventional-changelog-cli`).

## [Unreleased]

### Added

- **CI: container image scan (Trivy).** Новий workflow
  `.github/workflows/container-scan.yml` збирає `Dockerfile.api` і
  сканує отриманий образ на CVE рівнів CRITICAL/HIGH; SARIF
  завантажується в GitHub Code Scanning (`category: trivy-image`) і
  доступний як артефакт. Тригери: PR (на зміни Dockerfile / serverside
  пакетів), push to main, schedule (04:00 UTC) і workflow_dispatch.
  Триаж — див. [`docs/security/container-scan.md`](./docs/security/container-scan.md).

### Changed

- **Web: strict TS rollout — Phase 2.** `apps/web/tsconfig.strict.json`
  розширено з `src/shared/**` до 10 директорій
  (`src/shared`, `src/test`, `src/core/{auth, cloudSync, components,
hints, hooks, observability, pricing, profile}`). Cross-file
  SpeechRecognition type-collision між `useSpeech.ts` та
  `VoiceMicButton.tsx` виправлено зняттям глобальної
  `declare global Window` augmentation на користь приватного
  `WindowWithSpeech` cast у `useSpeech.ts`. Жодних змін у runtime-коді,
  лише типи + один тестовий null-guard у
  `useCloudSync.behavior.test.ts`. Деталі — у
  [`docs/tech-debt/frontend.md`](./docs/tech-debt/frontend.md) §11.
