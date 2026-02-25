import { Redirect, Stack } from "expo-router";
import { useAuth } from "../../lib/auth";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";

export default function AuthLayout() {
  const { session, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner text="Loading..." />;
  }

  // Already authenticated — go to main app
  if (session) {
    return <Redirect href="/(app)/(dashboard)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
    </Stack>
  );
}
