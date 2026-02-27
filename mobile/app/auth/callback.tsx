import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import { supabase } from "../../lib/supabase";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";

/**
 * Deep link callback handler for auth flows (email confirmation, password reset).
 *
 * Supabase redirects to `aviary://auth/callback?code=XXX` after:
 * - Email signup confirmation
 * - Password reset email link
 *
 * This screen exchanges the code for a session via PKCE, then redirects
 * to the dashboard on success or back to login on failure.
 */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleCallback() {
      // The code can come from search params (Expo Router) or the raw URL
      let code = params.code ?? null;

      if (!code) {
        // Fallback: parse the URL directly in case Expo Router didn't extract it
        try {
          const url = await Linking.getInitialURL();
          if (url) {
            const parsed = new URL(url);
            code = parsed.searchParams.get("code");
          }
        } catch {
          // ignore parse errors
        }
      }

      if (!code) {
        setError("No confirmation code found. The link may have expired.");
        setTimeout(() => router.replace("/(auth)/login"), 3000);
        return;
      }

      try {
        const { error: sessionError } =
          await supabase.auth.exchangeCodeForSession(code);

        if (sessionError) {
          setError(sessionError.message);
          setTimeout(() => router.replace("/(auth)/login"), 3000);
          return;
        }

        // Session established — auth state change in AuthProvider will
        // redirect to dashboard automatically, but we also push explicitly
        // in case the listener hasn't fired yet.
        router.replace("/(app)/(dashboard)");
      } catch {
        setError("Something went wrong. Please try again.");
        setTimeout(() => router.replace("/(auth)/login"), 3000);
      }
    }

    void handleCallback();
  }, [params.code, router]);

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-[#faf9f7] dark:bg-[#0c0a09]">
        <View className="flex-1 items-center justify-center px-6">
          <Text className="mb-2 text-lg font-bold text-stone-800 dark:text-stone-100">
            Unable to verify
          </Text>
          <Text className="text-center text-sm text-stone-500 dark:text-stone-400">
            {error}
          </Text>
          <Text className="mt-4 text-xs text-stone-400 dark:text-stone-500">
            Redirecting to login...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#faf9f7] dark:bg-[#0c0a09]">
      <LoadingSpinner text="Verifying..." />
    </SafeAreaView>
  );
}
