import { Stack, Redirect } from "expo-router";
import { useAuth } from "../../lib/auth";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";

export default function AppLayout() {
  const { session, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner text="Loading..." />;
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(dashboard)" />
      <Stack.Screen
        name="groups/[id]"
        options={{ headerShown: false }}
      />
      <Stack.Screen name="invite/[token]" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}
