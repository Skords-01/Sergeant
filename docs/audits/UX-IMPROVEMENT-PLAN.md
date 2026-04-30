# 🛠️ Технічний план покращення UI/UX

> **Last validated:** 2026-04-28 by @Skords-01. **Next review:** 2026-07-27.
> **Status:** Active

**Базується на:** UX-UI-AUDIT-2026.md  
**Автор:** v0 AI  
**Дата:** 28 квітня 2026

---

## 📁 Структура змін

```
apps/mobile/
├── src/
│   ├── components/ui/
│   │   ├── BackButton.tsx          ← НОВИЙ
│   │   ├── Sheet.tsx               ← МОДИФІКАЦІЯ (gesture dismiss)
│   │   ├── Input.tsx               ← МОДИФІКАЦІЯ (helper icons)
│   │   ├── EmptyState.tsx          ← МОДИФІКАЦІЯ (semantic tokens)
│   │   ├── PageSkeleton.tsx        ← НОВИЙ
│   │   └── Toast.tsx               ← МОДИФІКАЦІЯ (safe area)
│   ├── core/
│   │   ├── theme/
│   │   │   └── ColorSchemeBridge.tsx ← МОДИФІКАЦІЯ (dark mode)
│   │   └── settings/
│   │       └── HubSettingsPage.tsx  ← МОДИФІКАЦІЯ (grouping)
│   └── hooks/
│       └── useTabBadges.ts         ← МОДИФІКАЦІЯ (all modules)
├── app/
│   ├── (auth)/
│   │   └── forgot-password.tsx     ← НОВИЙ
│   └── (tabs)/_layout.tsx          ← МОДИФІКАЦІЯ (badges)
└── global.css                      ← МОДИФІКАЦІЯ (new tokens)
```

---

## 🔴 P0: Критичні покращення

### 1. Реалізація Dark Mode

#### 1.1 Оновити ColorSchemeBridge.tsx

```tsx
// apps/mobile/src/core/theme/ColorSchemeBridge.tsx

import { useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";

const THEME_KEY = "sergeant_theme_preference";

export type ThemeMode = "light" | "dark" | "system";

export function useThemeMode() {
  const systemScheme = useColorScheme();
  const [userPreference, setUserPreference] = useState<ThemeMode>("system");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((value) => {
      if (value === "light" || value === "dark" || value === "system") {
        setUserPreference(value);
      }
      setIsLoaded(true);
    });
  }, []);

  const setTheme = async (mode: ThemeMode) => {
    setUserPreference(mode);
    await AsyncStorage.setItem(THEME_KEY, mode);
  };

  const resolvedScheme =
    userPreference === "system" ? (systemScheme ?? "light") : userPreference;

  return {
    mode: userPreference,
    resolvedScheme,
    setTheme,
    isLoaded,
    isDark: resolvedScheme === "dark",
  };
}

export function ColorSchemeBridge() {
  const { resolvedScheme, isDark } = useThemeMode();

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      {/* NativeWind автоматично застосовує .dark клас */}
    </>
  );
}
```

#### 1.2 Додати Theme Toggle в GeneralSection

```tsx
// Додати в apps/mobile/src/core/settings/GeneralSection.tsx

import { useThemeMode, type ThemeMode } from "../theme/ColorSchemeBridge";

function ThemeToggle() {
  const { mode, setTheme } = useThemeMode();

  const options: { value: ThemeMode; label: string; icon: string }[] = [
    { value: "light", label: "Світла", icon: "☀️" },
    { value: "dark", label: "Темна", icon: "🌙" },
    { value: "system", label: "Системна", icon: "📱" },
  ];

  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-fg">Тема оформлення</Text>
      <View className="flex-row gap-2">
        {options.map((opt) => (
          <Pressable
            key={opt.value}
            onPress={() => setTheme(opt.value)}
            className={cx(
              "flex-1 flex-row items-center justify-center gap-2 rounded-xl border py-3",
              mode === opt.value
                ? "border-brand-500 bg-brand-50"
                : "border-line bg-panel",
            )}
          >
            <Text>{opt.icon}</Text>
            <Text
              className={cx(
                "text-sm font-medium",
                mode === opt.value ? "text-brand-700" : "text-fg",
              )}
            >
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
```

---

### 2. Уніфікований компонент BackButton

```tsx
// apps/mobile/src/components/ui/BackButton.tsx

import { forwardRef } from "react";
import { Pressable, type PressableProps, View } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { useRouter } from "expo-router";

import { hapticTap } from "@sergeant/shared";
import { colors } from "@/theme";

export type BackButtonVariant = "default" | "ghost" | "overlay";
export type BackButtonSize = "sm" | "md" | "lg";

const variants: Record<BackButtonVariant, string> = {
  default: "bg-cream-100 border border-cream-200",
  ghost: "bg-transparent",
  overlay: "bg-black/30",
};

const sizes: Record<BackButtonSize, { button: string; icon: number }> = {
  sm: { button: "h-9 w-9 min-h-[44px] min-w-[44px]", icon: 20 },
  md: { button: "h-11 w-11 min-h-[44px] min-w-[44px]", icon: 24 },
  lg: { button: "h-14 w-14 min-h-[48px] min-w-[48px]", icon: 28 },
};

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export interface BackButtonProps extends Omit<PressableProps, "children"> {
  variant?: BackButtonVariant;
  size?: BackButtonSize;
  /** Якщо true, використовує router.back() автоматично */
  autoNavigate?: boolean;
  /** Custom icon color */
  iconColor?: string;
  className?: string;
}

export const BackButton = forwardRef<View, BackButtonProps>(function BackButton(
  {
    variant = "default",
    size = "md",
    autoNavigate = true,
    iconColor,
    className,
    onPress,
    ...props
  },
  ref,
) {
  const router = useRouter();

  const handlePress = (
    e: Parameters<NonNullable<PressableProps["onPress"]>>[0],
  ) => {
    hapticTap();
    if (onPress) {
      onPress(e);
    } else if (autoNavigate) {
      router.back();
    }
  };

  const resolvedIconColor =
    iconColor ?? (variant === "overlay" ? "#fff" : colors.text);
  const sizeConfig = sizes[size];

  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel="Повернутися назад"
      onPress={handlePress}
      className={cx(
        "items-center justify-center rounded-full active:opacity-70 active:scale-95",
        sizeConfig.button,
        variants[variant],
        className,
      )}
      hitSlop={8}
      {...props}
    >
      <ChevronLeft
        size={sizeConfig.icon}
        color={resolvedIconColor}
        strokeWidth={2}
      />
    </Pressable>
  );
});

// Re-export для index
export default BackButton;
```

---

### 3. Жест закриття Sheet

```tsx
// Оновлення apps/mobile/src/components/ui/Sheet.tsx
// Додати gesture handler для swipe-to-dismiss

import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from "react-native-reanimated";

// Всередині Sheet компоненту:

export function Sheet({} /* props */ : SheetProps) {
  const translateY = useSharedValue(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const { height: windowHeight } = useWindowDimensions();

  // ... existing reduceMotion effect ...

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      // Тільки вниз (позитивний Y)
      if (e.translationY > 0) {
        translateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      const shouldClose = e.translationY > 100 || e.velocityY > 500;
      if (shouldClose) {
        translateY.value = withSpring(windowHeight, {}, () => {
          runOnJS(onClose)();
        });
      } else {
        translateY.value = withSpring(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // ... rest of component ...

  return (
    <Modal visible transparent animationType={reduceMotion ? "none" : "slide"}>
      <View className="flex-1 justify-end">
        {/* Scrim */}
        <Pressable onPress={onClose} className="absolute inset-0 bg-black/40" />

        <GestureDetector gesture={panGesture}>
          <Animated.View style={animatedStyle}>
            <KeyboardAvoidingView /* ... */>
              {/* Drag indicator */}
              <View className="flex items-center pt-3 pb-1">
                <View
                  className="w-10 h-1 bg-cream-300 rounded-full"
                  accessibilityLabel="Потягніть вниз щоб закрити"
                />
              </View>
              {/* ... rest of sheet content ... */}
            </KeyboardAvoidingView>
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
}
```

---

## 🟠 P1: Важливі покращення

### 4. Іконки-підказки в інпутах

```tsx
// Оновлення apps/mobile/src/components/ui/Input.tsx
// Додати іконки для error/success states

import { AlertCircle, CheckCircle } from "lucide-react-native";

// В InputProps додати:
export interface InputProps /* ... */ {
  /** Show icon in helper text for error/success */
  showHelperIcon?: boolean;
}

// В рендері helper text:
{
  helperText ? (
    <View className="flex-row items-center gap-1.5 mt-1">
      {showHelperIcon && error && (
        <AlertCircle size={14} color={colors.danger} strokeWidth={2} />
      )}
      {showHelperIcon && success && (
        <CheckCircle size={14} color={colors.success} strokeWidth={2} />
      )}
      <Text
        className={cx(
          "text-xs leading-snug flex-1",
          error ? "text-danger" : success ? "text-success" : "text-fg-muted",
        )}
      >
        {helperText}
      </Text>
    </View>
  ) : null;
}
```

---

### 5. Бейджі на всіх табах модулів

```tsx
// Оновлення apps/mobile/src/hooks/useTabBadges.ts

import { useMemo } from "react";
import { useFinykOverBudget } from "@/modules/finyk/hooks/useFinykOverBudget";
import { useFizrukMissedWorkouts } from "@/modules/fizruk/hooks/useFizrukMissedWorkouts";
import { useRoutinePending } from "@/modules/routine/hooks/useRoutinePending";
import { useNutritionAlerts } from "@/modules/nutrition/hooks/useNutritionAlerts";

export interface TabBadges {
  finyk: number | undefined;
  fizruk: number | undefined;
  routine: number | undefined;
  nutrition: number | undefined;
}

export function useTabBadges(): TabBadges {
  const finykOverBudget = useFinykOverBudget();
  const fizrukMissed = useFizrukMissedWorkouts();
  const routinePending = useRoutinePending();
  const nutritionAlerts = useNutritionAlerts();

  return useMemo(
    () => ({
      finyk: finykOverBudget > 0 ? finykOverBudget : undefined,
      fizruk: fizrukMissed > 0 ? fizrukMissed : undefined,
      routine: routinePending > 0 ? routinePending : undefined,
      nutrition: nutritionAlerts > 0 ? nutritionAlerts : undefined,
    }),
    [finykOverBudget, fizrukMissed, routinePending, nutritionAlerts],
  );
}
```

```tsx
// Оновлення apps/mobile/app/(tabs)/_layout.tsx

<Tabs.Screen
  name="finyk"
  options={{
    title: "ФІНІК",
    tabBarIcon: createTabIcon(Wallet),
    tabBarBadge: badges.finyk,
    tabBarBadgeStyle: { backgroundColor: colors.warning },
  }}
/>
<Tabs.Screen
  name="fizruk"
  options={{
    title: "ФІЗРУК",
    tabBarIcon: createTabIcon(Dumbbell),
    tabBarBadge: badges.fizruk,
    tabBarBadgeStyle: { backgroundColor: colors.info },
    headerShown: false,
  }}
/>
<Tabs.Screen
  name="routine"
  options={{
    title: "Рутина",
    tabBarIcon: createTabIcon(CheckSquare),
    tabBarBadge: badges.routine,
    tabBarBadgeStyle: { backgroundColor: colors.coral[500] },
  }}
/>
<Tabs.Screen
  name="nutrition"
  options={{
    title: "Їжа",
    tabBarIcon: createTabIcon(UtensilsCrossed),
    tabBarBadge: badges.nutrition,
    tabBarBadgeStyle: { backgroundColor: colors.lime[600] },
  }}
/>
```

---

### 6. Семантичні токени для EmptyState

```tsx
// Оновлення apps/mobile/src/components/ui/EmptyState.tsx
// Замінити hardcoded colors на semantic tokens

// ❌ Було:
iconColor = "#94a3b8";
className = "text-slate-800";
className = "text-emerald-500";

// ✅ Стало:
iconColor = colors.muted; // з @/theme
className = "text-fg";
className = "text-brand-strong";

// Повний оновлений код:
export function EmptyState({
  icon: IconComponent,
  title,
  description,
  action,
  className,
  compact = false,
  disableAnimation = false,
  iconColor, // Тепер optional, використовує colors.subtle
}: EmptyStateProps) {
  const resolvedIconColor = iconColor ?? colors.subtle;

  // ...

  return (
    <Animated.View /* ... */>
      {IconComponent && (
        <Animated.View
          className={cx(
            "items-center justify-center rounded-2xl bg-surface-muted border border-line",
            compact ? "w-12 h-12" : "w-16 h-16",
          )}
        >
          <IconComponent
            size={compact ? 24 : 32}
            color={resolvedIconColor}
            strokeWidth={1.5}
          />
        </Animated.View>
      )}

      {title && (
        <Text
          className={cx(
            "font-semibold text-fg text-center",
            compact ? "text-sm" : "text-base",
          )}
        >
          {title}
        </Text>
      )}

      {description && (
        <Text
          className={cx(
            "text-fg-muted text-center leading-relaxed max-w-xs",
            compact ? "text-xs" : "text-sm",
          )}
        >
          {description}
        </Text>
      )}

      {action && (
        <Animated.View className="mt-2">
          <Pressable
            onPress={handleActionPress}
            className={cx(
              "px-5 py-2.5 rounded-xl active:scale-95",
              action.variant === "secondary"
                ? "bg-surface-muted border border-line"
                : "bg-brand-strong",
            )}
          >
            <Text
              className={cx(
                "font-semibold text-sm",
                action.variant === "secondary" ? "text-fg" : "text-white",
              )}
            >
              {action.label}
            </Text>
          </Pressable>
        </Animated.View>
      )}
    </Animated.View>
  );
}
```

---

## 🟡 P2: Середні покращення

### 7. Групування сторінки Settings

```tsx
// Оновлення apps/mobile/src/core/settings/HubSettingsPage.tsx

import { StickyHeader } from "@/components/ui/StickyHeader";

const SETTING_GROUPS = [
  {
    id: "general",
    title: "Загальні",
    sections: [GeneralSection, NotificationsSection],
  },
  {
    id: "modules",
    title: "Модулі",
    sections: [RoutineSection, FinykSection, FizrukSection],
  },
  {
    id: "ai",
    title: "AI та Асистент",
    sections: [AIDigestSection, AssistantCatalogueSection],
  },
  {
    id: "account",
    title: "Акаунт",
    sections: [ExperimentalSection, AccountSection],
  },
];

export function HubSettingsPage() {
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  return (
    <SafeAreaView className="flex-1 bg-cream-50" edges={["top"]}>
      {/* Sticky group tabs */}
      <View className="border-b border-line bg-panel px-4 py-2">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2">
            {SETTING_GROUPS.map((group) => (
              <Pressable
                key={group.id}
                onPress={() => {
                  // Scroll to group
                }}
                className={cx(
                  "px-4 py-2 rounded-full",
                  activeGroup === group.id ? "bg-brand-100" : "bg-cream-100",
                )}
              >
                <Text
                  className={cx(
                    "text-sm font-medium",
                    activeGroup === group.id
                      ? "text-brand-700"
                      : "text-fg-muted",
                  )}
                >
                  {group.title}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 24 }}
      >
        <Text className="text-[22px] font-bold text-fg">Налаштування</Text>

        {SETTING_GROUPS.map((group) => (
          <View key={group.id} className="gap-3">
            <Text className="text-sm font-semibold text-fg-muted uppercase tracking-wide">
              {group.title}
            </Text>
            {group.sections.map((Section, idx) => (
              <Section key={idx} />
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
```

---

### 8. Фікс safe-area для Toast

```tsx
// Оновлення apps/mobile/src/components/ui/Toast.tsx

import { useSafeAreaInsets } from "react-native-safe-area-context";

export function ToastContainer({ className }: ToastContainerProps) {
  const { toasts, dismiss } = useToast();
  const insets = useSafeAreaInsets();

  if (toasts.length === 0) return null;

  return (
    <GestureHandlerRootView
      style={{
        position: "absolute",
        top: insets.top, // ← Враховуємо safe area
        left: 0,
        right: 0,
        zIndex: 50,
      }}
    >
      {/* ... rest ... */}
    </GestureHandlerRootView>
  );
}
```

---

### 9. Екран Forgot Password

```tsx
// apps/mobile/app/(auth)/forgot-password.tsx

import { useState } from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Mail, ArrowLeft } from "lucide-react-native";

import { requestPasswordReset } from "@/auth/authClient";
import { colors } from "@/theme";
import { BackButton } from "@/components/ui/BackButton";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не вдалося надіслати лист");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={["bottom"]}>
        <View className="flex-1 px-6 justify-center items-center gap-4">
          <View className="w-20 h-20 items-center justify-center rounded-3xl bg-brand-100 mb-2">
            <Mail size={40} color={colors.accent} strokeWidth={1.5} />
          </View>
          <Text className="text-text text-2xl font-bold text-center">
            Перевірте пошту
          </Text>
          <Text className="text-muted text-sm text-center max-w-xs">
            Ми надіслали інструкції для відновлення пароля на {email}
          </Text>
          <Button
            variant="secondary"
            size="lg"
            onPress={() => router.back()}
            className="mt-4"
          >
            Повернутися до входу
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["bottom"]}>
      <View className="px-4 py-2">
        <BackButton />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 px-6 justify-center gap-4"
      >
        <Text className="text-text text-2xl font-bold">Забули пароль?</Text>
        <Text className="text-muted text-sm mb-4">
          Введіть email і ми надішлемо інструкції для відновлення
        </Text>

        <Input
          type="email"
          placeholder="ваш@email.com"
          value={email}
          onChangeText={setEmail}
          size="lg"
          error={!!error}
          helperText={error ?? undefined}
          showHelperIcon
        />

        <Button
          variant="primary"
          size="lg"
          loading={loading}
          disabled={!email || loading}
          onPress={onSubmit}
        >
          Надіслати інструкції
        </Button>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
```

---

## 📊 Чеклист впровадження

### Фаза 1 (тижні 1–4)

- [ ] **Week 1**
  - [ ] Імплементувати `ColorSchemeBridge` з theme toggle
  - [ ] Додати `ThemeToggle` в `GeneralSection`
  - [ ] Створити `BackButton` компонент
  - [ ] Замінити всі ← текстові кнопки на `BackButton`

- [ ] **Week 2**
  - [x] Додати gesture dismiss в `Sheet` _(web — done у [#1181](https://github.com/Skords-01/Sergeant/pull/1181) через `useSwipeToDismiss`; також застосовано в `ConfirmDialog` і `ModuleSettingsDrawer`. Mobile RN-частина — pending.)_
  - [ ] Встановити `react-native-reanimated` якщо ще не встановлено
  - [ ] Тестувати на iOS та Android

- [ ] **Week 3**
  - [ ] Оновити `Input` з helper icons
  - [ ] Оновити `EmptyState` з semantic tokens
  - [ ] Виправити `Toast` safe area

- [ ] **Week 4**
  - [ ] Реструктуризувати `HubSettingsPage`
  - [ ] Створити `forgot-password.tsx` маршрут
  - [ ] E2E тести для нових flows

### Фаза 2 (тижні 5–8)

- [ ] **Week 5**
  - [ ] Створити хуки для badge counts (всі модулі)
  - [ ] Оновити `_layout.tsx` з badges

- [ ] **Week 6**
  - [ ] Pull-to-refresh на `HubDashboard`
  - [ ] Loading state audit всіх сторінок

- [ ] **Week 7-8**
  - [ ] Unified `PageSkeleton` компонент
  - [ ] Custom `ModuleErrorBoundary` UI
  - [ ] Accessibility audit та виправлення

---

## 🧪 Тестування

### Unit-тести

```tsx
// __tests__/BackButton.test.tsx
describe("BackButton", () => {
  it("renders correctly with default props", () => {});
  it("calls onPress when tapped", () => {});
  it("navigates back when autoNavigate is true", () => {});
  it("applies correct styles for each variant", () => {});
});

// __tests__/Sheet.test.tsx
describe("Sheet gesture dismiss", () => {
  it("closes on swipe down > 100px", () => {});
  it("snaps back on swipe down < 100px", () => {});
  it("respects reduceMotion setting", () => {});
});
```

### E2E-тести (Detox)

```tsx
// e2e/dark-mode.e2e.ts
describe("Dark Mode", () => {
  it("should toggle theme in settings", async () => {
    await element(by.id("tab-hub")).tap();
    await element(by.id("dashboard-settings-button")).tap();
    await element(by.text("Темна")).tap();
    // Assert dark theme applied
  });
});
```

---

## 📈 Метрики для відстеження

| Метрика                    | Baseline | Target      | Як виміряти              |
| -------------------------- | -------- | ----------- | ------------------------ |
| Dark mode adoption         | 0%       | 30%+        | Analytics event          |
| Sheet dismiss rate         | N/A      | <5% abandon | Funnel analytics         |
| Settings page scroll depth | ~40%     | 80%+        | Heatmap                  |
| Error recovery rate        | ~60%     | 90%+        | Error boundary callbacks |
| A11y violations            | Unknown  | 0 critical  | aXe audit                |

---

_Документ є частиною UX Improvement Initiative Q2 2026_
