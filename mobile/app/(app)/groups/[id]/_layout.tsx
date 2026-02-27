import { Stack } from "expo-router";

export default function GroupLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="expense/[expenseId]/index" options={{ presentation: "modal" }} />
    </Stack>
  );
}
