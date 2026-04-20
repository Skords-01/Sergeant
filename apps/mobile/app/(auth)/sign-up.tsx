import { Link, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { signUp } from "@/auth/authClient";
import { colors, radius, spacing } from "@/theme";

export default function SignUpScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      const res = await signUp.email({ email, password, name });
      if (res.error) {
        setError(res.error.message ?? "Не вдалося створити акаунт");
        return;
      }
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не вдалося створити акаунт");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.form}
      >
        <Text style={styles.title}>Створити акаунт</Text>
        <Text style={styles.subtitle}>
          Мінімум 10 символів пароль (NIST SP 800-63B).
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Ім'я"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="words"
          textContentType="name"
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={styles.input}
          placeholder="email@example.com"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="пароль (10+ символів)"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          textContentType="newPassword"
          value={password}
          onChangeText={setPassword}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={({ pressed }) => [
            styles.button,
            (pressed || loading) && styles.buttonPressed,
          ]}
          onPress={onSubmit}
          disabled={loading || !name || !email || password.length < 10}
        >
          {loading ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Text style={styles.buttonText}>Зареєструватися</Text>
          )}
        </Pressable>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Вже є акаунт?</Text>
          <Link href="/(auth)/sign-in" style={styles.footerLink}>
            <Text style={styles.footerLinkText}>Увійти</Text>
          </Link>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  form: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: "center",
    gap: spacing.md,
  },
  title: { color: colors.text, fontSize: 28, fontWeight: "700" },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: spacing.lg,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: 16,
  },
  error: { color: colors.danger, fontSize: 13 },
  button: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  buttonPressed: { opacity: 0.7 },
  buttonText: { color: colors.text, fontSize: 16, fontWeight: "600" },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  footerText: { color: colors.textMuted, fontSize: 14 },
  footerLink: { paddingHorizontal: spacing.xs },
  footerLinkText: { color: colors.accent, fontSize: 14, fontWeight: "500" },
});
