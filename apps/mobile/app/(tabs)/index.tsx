import { Alert, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { useUser, usePushTest } from "@sergeant/api-client/react";
import { signOut } from "@/auth/authClient";
import { Pressable } from "react-native";
import { colors, radius, spacing } from "@/theme";

export default function HubScreen() {
  const { data } = useUser();
  const user = data?.user;
  const queryClient = useQueryClient();
  // `__DEV__` — global, який Metro замінює на `false` у prod-bundle-і
  // (через `global.__DEV__ = false` у `react-native/Libraries/Core/setUpDeveloperTools.js`).
  // Тож UI-ланцюг і сам хук dead-code-eliminated-яться при prod-збірці —
  // `usePushTest` навіть не викликається, якщо `__DEV__ = false`.
  const pushTest = usePushTest({
    onError: (err) => {
      Alert.alert("Push test failed", err.message);
    },
    onSuccess: (summary) => {
      Alert.alert(
        "Push test sent",
        `ios=${summary.delivered.ios} android=${summary.delivered.android} web=${summary.delivered.web}` +
          (summary.errors.length ? `\nerrors: ${summary.errors.length}` : ""),
      );
    },
  });

  // useUser() під капотом — react-query, який не є реактивним до
  // змін Better Auth SecureStore. Без явного скидання кешу auth-guard
  // у `(tabs)/_layout.tsx` продовжить бачити старого `data.user` і не
  // зредиректить на /(auth)/sign-in. Скидаємо весь кеш, бо на виході
  // інвалідний не лише `/me`, а й усі юзер-скоуплені дані.
  const handleSignOut = async () => {
    try {
      await signOut();
    } finally {
      queryClient.clear();
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Text style={styles.title}>Sergeant</Text>
      <Text style={styles.subtitle}>
        Привіт, {user?.name ?? user?.email ?? "друже"}
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Нативний клієнт — Фаза 0</Text>
        <Text style={styles.cardBody}>
          Скафолд готовий: експо-роутер, авторизація через Better Auth bearer,
          таби для модулів. Далі — поступовий порт модулів (Finyk → Fizruk →
          Routine → Nutrition) з web-app в нативні екрани.
        </Text>
      </View>

      {__DEV__ ? (
        <Pressable
          style={({ pressed }) => [styles.devButton, pressed && styles.pressed]}
          onPress={() =>
            pushTest.mutate({ title: "Sergeant", body: "It works" })
          }
          disabled={pushTest.isPending}
        >
          <Text style={styles.devButtonText}>
            {pushTest.isPending ? "Надсилаю…" : "DEV: надіслати тестовий пуш"}
          </Text>
        </Pressable>
      ) : null}

      <Pressable
        style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}
        onPress={handleSignOut}
      >
        <Text style={styles.signOutText}>Вийти</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: spacing.sm,
  },
  cardBody: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  signOut: {
    marginTop: "auto",
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: "center",
  },
  signOutText: { color: colors.danger, fontSize: 15, fontWeight: "500" },
  devButton: {
    marginBottom: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  devButtonText: { color: colors.text, fontSize: 14, fontWeight: "500" },
  pressed: { opacity: 0.6 },
});
