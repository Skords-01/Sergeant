import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession, signOut } from "@/auth/authClient";
import { Pressable } from "react-native";
import { colors, radius, spacing } from "@/theme";

export default function HubScreen() {
  const { data: session } = useSession();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Text style={styles.title}>Sergeant</Text>
      <Text style={styles.subtitle}>
        Привіт, {session?.user?.name ?? session?.user?.email ?? "друже"}
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Нативний клієнт — Фаза 0</Text>
        <Text style={styles.cardBody}>
          Скафолд готовий: експо-роутер, авторизація через Better Auth bearer,
          таби для модулів. Далі — поступовий порт модулів (Finyk → Fizruk →
          Routine → Nutrition) з web-app в нативні екрани.
        </Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}
        onPress={() => signOut()}
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
  pressed: { opacity: 0.6 },
});
