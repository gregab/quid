import { Stack, Redirect, useLocalSearchParams } from "expo-router";
import { useAuth } from "../../lib/auth";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";

export default function AuthLayout() {
  const { session, loading } = useAuth();
  const { next } = useLocalSearchParams<{ next?: string }>();

  if (loading) {
    return <LoadingSpinner text="Loading..." />;
  }

  if (session) {
    return <Redirect href={next ? (next as `/${string}`) : "/(app)/(dashboard)"} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
    </Stack>
  );
}
