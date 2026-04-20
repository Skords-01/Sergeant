import { Redirect, Tabs } from "expo-router";
import { Text } from "react-native";
import { useUser } from "@sergeant/api-client/react";
import { colors } from "@/theme";

type TabIconProps = {
  color: string;
  focused: boolean;
};

function TabIcon({ emoji }: { emoji: string }) {
  return function Icon({ color, focused }: TabIconProps) {
    return (
      <Text
        style={{
          fontSize: 22,
          opacity: focused ? 1 : 0.6,
          color,
        }}
      >
        {emoji}
      </Text>
    );
  };
}

export default function TabsLayout() {
  const { data, isLoading } = useUser();

  if (!isLoading && !data?.user) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { color: colors.text },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Хаб", tabBarIcon: TabIcon({ emoji: "🏠" }) }}
      />
      <Tabs.Screen
        name="finyk"
        options={{ title: "ФІНІК", tabBarIcon: TabIcon({ emoji: "💰" }) }}
      />
      <Tabs.Screen
        name="fizruk"
        options={{
          title: "ФІЗРУК",
          tabBarIcon: TabIcon({ emoji: "🏋" }),
          // The Fizruk tab hosts a nested Expo Router `Stack` (see
          // `app/(tabs)/fizruk/_layout.tsx`) that draws its own headers
          // per screen. Hiding the Tabs header prevents a double bar.
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="routine"
        options={{ title: "Рутина", tabBarIcon: TabIcon({ emoji: "✅" }) }}
      />
      <Tabs.Screen
        name="nutrition"
        options={{ title: "Їжа", tabBarIcon: TabIcon({ emoji: "🍽" }) }}
      />
    </Tabs>
  );
}
