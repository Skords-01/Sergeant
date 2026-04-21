/**
 * Sergeant Hub-core — AIDigestSection (React Native, first cut)
 *
 * Mobile mirror of `apps/web/src/core/settings/AIDigestSection.tsx`.
 *
 * Within-reach parity (does the real thing now):
 *  - Week-range preview card — чистий date-помічник рахує Пн–Нд
 *    поточного тижня (uk-UA `day: "numeric", month: "short"`), так
 *    само як web `getWeekRange`. Карточка зверху pre-view-карти
 *    «Поточний тиждень».
 *  - "Автогенерація щопонеділка" toggle — персистить `"1"` / `"0"`
 *    у MMKV під `STORAGE_KEYS.WEEKLY_DIGEST_MONDAY_AUTO`. Ключ +
 *    значення дзеркальні до web `AIDigestSection`, отож payload
 *    їде під тим самим cloud-sync-конвертом без міграцій.
 *
 * Deferred (див. `docs/react-native-migration.md` Phase 2 /
 * Hub-core, §2.4) — рендериться як `DeferredNotice`-карточка
 * всередині групи:
 *  - **Генерація звіту тижня.** Web викликає `useWeeklyDigest.generate`,
 *    який тягне `coachApi`/`weeklyDigestApi` через React Query та
 *    агрегує дані з локальних кешів фінансів/тренувань/харчування.
 *    Жоден із цих доменних модулів не портований на mobile,
 *    тому на mobile цей PR лише вмикає прапорець автогенерації —
 *    саме AI-генерація підключиться разом із портом модуля
 *    AI-дайджести.
 */

import { useMemo } from "react";
import { Text, View } from "react-native";
import { STORAGE_KEYS } from "@sergeant/shared";

import { Card } from "@/components/ui/Card";
import { useLocalStorage } from "@/lib/storage";

import { SettingsGroup, ToggleRow } from "./SettingsPrimitives";

/**
 * Локальна копія web `getWeekRange` — pure, без `Intl`-специфіки,
 * яка могла б відрізнятися між web/hermes. Повертає рядок формату
 * `"Пн 15 кві — Нд 21 кві"` для тижня, що містить `date` (Пн-Нд).
 *
 * Дублюємо тут замість ліфту у `@sergeant/shared`, щоб не розширювати
 * публічну поверхню пакета заради одного помічника, що живе рівно
 * у двох місцях (web `useWeeklyDigest.ts` + mobile AIDigestSection).
 * Коли модуль AI-дайджести реально портуватиметься на mobile,
 * спільний helper нормалізуємо разом з іншим доменним кодом.
 */
export function getWeekRange(date: Date = new Date()): string {
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (dt: Date): string =>
    dt.toLocaleDateString("uk-UA", { day: "numeric", month: "short" });
  return `${fmt(monday)} — ${fmt(sunday)}`;
}

function DeferredNotice({ children }: { children: string }) {
  return (
    <Card variant="flat" radius="md" padding="md" className="border-dashed">
      <Text className="text-xs text-stone-500 leading-snug">{children}</Text>
    </Card>
  );
}

export function AIDigestSection() {
  const [mondayAutoRaw, setMondayAutoRaw] = useLocalStorage<string>(
    STORAGE_KEYS.WEEKLY_DIGEST_MONDAY_AUTO,
    "",
  );
  const mondayAuto = mondayAutoRaw === "1";

  const weekRange = useMemo(() => getWeekRange(), []);

  return (
    <SettingsGroup title="AI Звіт тижня" emoji="📋">
      <Text className="text-xs text-stone-500 leading-snug">
        Тижневий AI-аналіз прогресу по всіх модулях: фінанси, тренування,
        харчування та звички. Звіт доступний на дашборді щопонеділка або за
        запитом.
      </Text>
      <Card variant="flat" radius="md" padding="md">
        <Text className="text-xs font-semibold text-stone-900">
          Поточний тиждень
        </Text>
        <Text
          className="text-xs text-stone-500 mt-0.5"
          testID="aidigest-week-range"
        >
          {weekRange}
        </Text>
      </Card>

      <DeferredNotice>
        Генерація звіту тижня підключиться з портом модуля AI-дайджести — зараз
        налаштування автогенерації лише зберігається, сам виклик коуча ще не
        портований на mobile.
      </DeferredNotice>

      <View className="pt-1">
        <ToggleRow
          label="Автогенерація щопонеділка"
          description="Якщо ввімкнено, ранкова сесія в понеділок запускає звіт у фоні. Вимкнуто за замовчуванням — інакше AI-виклик зʼїдається без твого запиту."
          checked={mondayAuto}
          onChange={(next) => setMondayAutoRaw(next ? "1" : "0")}
          testID="aidigest-monday-auto-toggle"
        />
      </View>
    </SettingsGroup>
  );
}
