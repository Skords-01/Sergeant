import { Redirect, Stack } from "expo-router";
import { useSession } from "@/auth/authClient";
import { colors } from "@/theme";

export default function AuthLayout() {
  const { data: session, isPending } = useSession();

  if (!isPending && session) {
    return <Redirect href="/" />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTitleStyle: { color: colors.text },
        headerTintColor: colors.accent,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="sign-in" options={{ title: "Вхід" }} />
      <Stack.Screen name="sign-up" options={{ title: "Реєстрація" }} />
    </Stack>
  );
}
