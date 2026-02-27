import { useState } from "react";
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
} from "react-native";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { TriangleAlert } from "lucide-react-native";
import { makeRedirectUri } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "../../lib/supabase";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Card } from "../../components/ui/Card";
import { friendlyAuthError } from "../../lib/authErrors";

export default function LoginScreen() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setError("");
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (authError) {
      setError(friendlyAuthError(authError.message));
    } else if (next) {
      router.replace(next as `/${string}`);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setGoogleLoading(true);

    try {
      const redirectUri = makeRedirectUri({ scheme: "aviary", path: "auth/callback" });

      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: true,
        },
      });

      if (oauthError || !data.url) {
        setError(oauthError ? friendlyAuthError(oauthError.message) : "Something went wrong. Please try again.");
        setGoogleLoading(false);
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);

      if (result.type === "success" && result.url) {
        const url = new URL(result.url);
        // Supabase encodes tokens in the URL fragment
        const fragment = url.hash.substring(1);
        const params = new URLSearchParams(fragment);
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");

        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            setError(friendlyAuthError(sessionError.message));
          } else if (next) {
            router.replace(next as `/${string}`);
          }
        }
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#faf9f7] dark:bg-[#0c0a09]">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          className="px-6"
        >
          {/* Hero */}
          <View className="mb-8 items-center">
            <Text className="mb-2 text-5xl">🐦</Text>
            <Text className="font-serif-logo text-4xl text-stone-800 dark:text-stone-100">
              Aviary
            </Text>
            <Text className="mt-2 text-sm text-stone-500 dark:text-stone-400">
              Split expenses with friends
            </Text>
          </View>

          {/* Form card */}
          <Card variant="elevated" className="px-5 py-6">
            <View className="gap-4">
              {error ? (
                <View className="flex-row items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/50">
                  <TriangleAlert size={16} color="#d97706" />
                  <Text className="min-w-0 flex-1 text-xs text-amber-800 dark:text-amber-300">
                    {error}
                  </Text>
                </View>
              ) : null}

              <Input
                label="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                placeholder="you@example.com"
              />

              <Input
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
                textContentType="password"
                placeholder="••••••••"
              />

              <Button onPress={handleLogin} loading={loading} size="lg">
                Log In
              </Button>

              <View className="items-center">
                <Link href="/(auth)/forgot-password" asChild>
                  <Pressable accessibilityRole="link">
                    <Text className="text-sm text-stone-500 dark:text-stone-400">
                      Forgot password?
                    </Text>
                  </Pressable>
                </Link>
              </View>

              {/* Divider */}
              <View className="flex-row items-center gap-3">
                <View className="h-px flex-1 bg-stone-200 dark:bg-stone-700" />
                <Text className="text-xs text-stone-400 dark:text-stone-500">
                  or
                </Text>
                <View className="h-px flex-1 bg-stone-200 dark:bg-stone-700" />
              </View>

              {/* Google Sign-In */}
              <Button
                onPress={handleGoogleSignIn}
                loading={googleLoading}
                variant="secondary"
                size="lg"
              >
                Continue with Google
              </Button>
            </View>
          </Card>

          {/* Sign up link */}
          <View className="mt-6 flex-row items-center justify-center gap-1">
            <Text className="text-sm text-stone-500 dark:text-stone-400">
              Don&apos;t have an account?
            </Text>
            <Link href="/(auth)/signup" asChild>
              <Pressable accessibilityRole="link">
                <Text className="text-sm font-semibold text-amber-600 dark:text-amber-500">
                  Sign up
                </Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
