import { useState } from "react";
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
} from "react-native";
import { Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { friendlyAuthError } from "../../lib/authErrors";
import { MAX_DISPLAY_NAME, MAX_EMAIL } from "../../lib/queries/shared";

export default function SignupScreen() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSignup = async () => {
    if (!displayName.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (displayName.trim().length > MAX_DISPLAY_NAME) {
      setError(`Name must be ${MAX_DISPLAY_NAME} characters or less.`);
      return;
    }
    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }
    if (email.trim().length > MAX_EMAIL) {
      setError("Email address is too long.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setError("");
    setLoading(true);

    const { error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { displayName: displayName.trim() },
      },
    });

    setLoading(false);

    if (authError) {
      setError(friendlyAuthError(authError.message));
    } else {
      setEmailSent(true);
    }
  };

  if (emailSent) {
    return (
      <SafeAreaView className="flex-1 bg-[#faf9f7] dark:bg-[#0c0a09]">
        <View className="flex-1 items-center justify-center px-6">
          <Text className="mb-2 text-4xl">📬</Text>
          <Text className="mb-2 text-xl font-bold text-stone-800 dark:text-stone-100">
            Check your email
          </Text>
          <Text className="mb-6 text-center text-sm text-stone-500 dark:text-stone-400">
            We sent a confirmation link to {email}. Click the link to activate
            your account.
          </Text>
          <Link href="/(auth)/login" asChild>
            <Pressable accessibilityRole="link">
              <Text className="text-sm font-semibold text-amber-600 dark:text-amber-500">
                Back to login
              </Text>
            </Pressable>
          </Link>
        </View>
      </SafeAreaView>
    );
  }

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
              Create your account
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
              label="Display name"
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              placeholder="Your name"
              maxLength={MAX_DISPLAY_NAME}
            />

            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              placeholder="you@example.com"
              maxLength={MAX_EMAIL}
            />

            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              placeholder="At least 6 characters"
            />

            <Button onPress={handleSignup} loading={loading}>
              Sign Up
            </Button>
          </View>

          {/* Login link */}
          <View className="mt-6 flex-row items-center justify-center gap-1">
            <Text className="text-sm text-stone-500 dark:text-stone-400">
              Already have an account?
            </Text>
            <Link href="/(auth)/login" asChild>
              <Pressable accessibilityRole="link">
                <Text className="text-sm font-semibold text-amber-600 dark:text-amber-500">
                  Log in
                </Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
