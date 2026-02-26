import { useEffect } from "react";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "../../lib/auth";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";

export default function AuthLayout() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const { next } = useLocalSearchParams<{ next?: string }>();

  useEffect(() => {
    if (!loading && session) {
      if (next) {
        router.replace(next as `/${string}`);
      } else {
        router.replace("/(app)/(dashboard)");
      }
    }
  }, [session, loading, router, next]);

  if (loading || session) {
    return <LoadingSpinner text="Loading..." />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
    </Stack>
  );
}
