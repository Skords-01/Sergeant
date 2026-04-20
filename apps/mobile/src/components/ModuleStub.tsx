import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius, spacing } from "@/theme";

type Props = {
  title: string;
  description: string;
  plannedFeatures: ReadonlyArray<string>;
};

/**
 * Тимчасовий заглушковий екран для модуля.
 * Поступово замінюватиметься реальними екранами в наступних фазах порту.
 */
export function ModuleStub({ title, description, plannedFeatures }: Props) {
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Заплановано до порту</Text>
        {plannedFeatures.map((item) => (
          <View key={item} style={styles.row}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.rowText}>{item}</Text>
          </View>
        ))}
      </View>
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
    fontSize: 26,
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  description: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: "row",
    marginBottom: spacing.sm,
  },
  bullet: {
    color: colors.accent,
    marginRight: spacing.sm,
    fontSize: 14,
  },
  rowText: {
    color: colors.text,
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
});
