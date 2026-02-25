import { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { useAuth } from "../../lib/auth";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";

export default function AuthLayout() {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && session) {
      router.replace("/(app)/(dashboard)");
    }
  }, [session, loading, router]);

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
