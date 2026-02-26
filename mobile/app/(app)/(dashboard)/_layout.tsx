import { Stack } from "expo-router";

export default function DashboardLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="create-group"
        options={{ presentation: "modal" }}
      />
      <Stack.Screen
        name="add-friend-expense"
        options={{ presentation: "modal" }}
      />
    </Stack>
  );
}
