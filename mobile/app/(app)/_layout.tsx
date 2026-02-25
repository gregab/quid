import { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { useAuth } from "../../lib/auth";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";

export default function AppLayout() {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !session) {
      router.replace("/(auth)/login");
    }
  }, [session, loading, router]);

  if (loading || !session) {
    return <LoadingSpinner text="Loading..." />;
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
