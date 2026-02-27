import { Stack } from "expo-router";

export default function AddExpenseLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="split" />
      <Stack.Screen name="advanced" />
    </Stack>
  );
}
