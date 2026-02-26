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
import { supabase } from "../../lib/supabase";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { friendlyAuthError } from "../../lib/authErrors";

export default function LoginScreen() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

  return (
    <SafeAreaView className="flex-1 bg-[#faf9f7] dark:bg-[#0c0a09]">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
          keyboardShouldPersistTaps="handled"
          className="px-6"
        >
          {/* Hero */}
          <View className="mb-8 items-center">
            <Text className="mb-2 text-4xl">🐦</Text>
            <Text className="font-serif-logo text-3xl text-stone-800 dark:text-stone-100">
              Aviary
            </Text>
            <Text className="mt-1 text-sm text-stone-500 dark:text-stone-400">
              Welcome back
            </Text>
          </View>

          {/* Form */}
          <View className="gap-4">
            {error ? (
              <View className="rounded-xl bg-red-50 px-4 py-3 dark:bg-red-950/50">
                <Text className="text-xs text-red-600 dark:text-red-400">
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

            <Button onPress={handleLogin} loading={loading}>
              Log In
            </Button>
          </View>

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
