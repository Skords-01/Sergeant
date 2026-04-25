# Playbook: Port Web Screen to Mobile

**Trigger:** "Перенести екран X з apps/web в apps/mobile" / чергова фаза React Native міграції / `react-native-migration.md`.

---

## Steps

### 1. Визначити scope web-екрану

```bash
# Знайти компонент в apps/web
find apps/web/src -name "<ScreenName>*" -type f

# Перевірити залежності компонента
grep -n "import" apps/web/src/modules/<module>/pages/<Screen>.tsx
```

Розділити залежності на:

- **Reusable** (domain packages: `@sergeant/shared`, `@sergeant/api-client`, `@sergeant/finyk-domain` тощо) — переносяться as-is.
- **Web-specific** (React Router, Tailwind, web-only hooks) — потрібні RN-аналоги.

### 2. Створити screen в apps/mobile

```bash
# Expo Router використовує file-based routing
touch apps/mobile/app/(tabs)/<screen-name>.tsx
```

Базова структура:

```tsx
import { View, Text } from "react-native";
// Реюзати domain-пакети напряму
import { someUtil } from "@sergeant/shared";

export default function ScreenName() {
  return (
    <View>
      <Text>Screen Name</Text>
    </View>
  );
}
```

### 3. Замінити web-специфічні компоненти

| Web (apps/web)                   | Mobile (apps/mobile)                   |
| -------------------------------- | -------------------------------------- |
| `<div>`, `<span>`                | `<View>`, `<Text>`                     |
| Tailwind classes                 | StyleSheet / NativeWind                |
| `<Link to="...">` (React Router) | `<Link href="...">` (Expo Router)      |
| `useNavigate()`                  | `useRouter()` (Expo Router)            |
| `localStorage`                   | `AsyncStorage` / `SecureStore`         |
| `fetch` / React Query            | React Query (той самий `api-client`)   |
| `<img src="...">`                | `<Image source={{uri: "..."}}>`        |
| CSS animations                   | `react-native-reanimated`              |
| `window.addEventListener`        | RN `AppState` / `Dimensions` listeners |

### 4. Data fetching

Реюзати `@sergeant/api-client` напряму — ті самі endpoint-и, ті самі типи:

```tsx
import { api } from "@sergeant/api-client";
import { useQuery } from "@tanstack/react-query";
import { finykKeys } from "@shared/lib/queryKeys";

const { data } = useQuery({
  queryKey: finykKeys.accounts(),
  queryFn: () => api.mono.accounts(),
});
```

React Query key factories — ті самі з `queryKeys.ts` (AGENTS.md rule #2).

### 5. Навігація

Додати screen до tab-бару або stack navigator в `apps/mobile/app/_layout.tsx` (Expo Router).

### 6. Тести

```bash
# Тест на mobile
pnpm --filter @sergeant/mobile exec vitest run src/<path>/<Screen>.test.tsx
```

Перевірити на Expo Go (або Expo Dev Client) на реальному пристрої / емуляторі.

### 7. Створити PR

- Branch: `devin/<unix-ts>-feat-mobile-<screen>`
- Commit: `feat(mobile): port <screen-name> from web`
- PR description:
  - Який екран перенесено
  - Що реюзано з domain-пакетів
  - Які web-компоненти замінено на RN-аналоги
  - Screenshot з мобільного (обов'язково)

---

## Verification

- [ ] `pnpm lint` — green
- [ ] `pnpm typecheck` — green
- [ ] Mobile тести — green (окрім known flaky: `OnboardingWizard`, `WeeklyDigestFooter`, `HubSettingsPage`)
- [ ] React Query keys — через factories (rule #2)
- [ ] Domain packages реюзано без дублювання
- [ ] Screenshot з мобільного додано до PR

## Notes

- `apps/mobile` — Expo 52 + React Native 0.76 + Expo Router (file-based routing).
- Domain packages (`@sergeant/finyk-domain`, `@sergeant/api-client` тощо) — спільні між web і mobile.
- Flaky mobile-тести не блокують merge (AGENTS.md).
- Якщо screen потребує native module — перевірити чи він доступний в Expo Go або потрібен dev-client build.

## See also

- [react-native-migration.md](../react-native-migration.md) — повний план міграції
- [mobile.md](../mobile.md) — загальна документація mobile app
- [AGENTS.md](../../AGENTS.md) — rule #2 (RQ keys), flaky tests
