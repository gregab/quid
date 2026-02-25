import { useState } from "react";
import {
  View,
  Text,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useColorScheme,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../../../lib/auth";
import {
  useCurrentUser,
  useUpdateProfile,
  useDeleteAccount,
  useGroups,
} from "../../../lib/queries";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { LoadingSpinner } from "../../../components/ui/LoadingSpinner";
import {
  MAX_DISPLAY_NAME,
  formatCents,
} from "../../../lib/queries/shared";

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const { data: profile, isLoading } = useCurrentUser();
  const { data: groups } = useGroups();
  const updateProfile = useUpdateProfile();
  const deleteAccount = useDeleteAccount();

  const colorScheme = useColorScheme();

  const [editingName, setEditingName] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);

  const startEditName = () => {
    setDisplayName(profile?.displayName ?? "");
    setEditingName(true);
  };

  const handleSaveName = async () => {
    const trimmed = displayName.trim();
    if (!trimmed) {
      setNameError("Display name is required.");
      return;
    }
    if (trimmed.length > MAX_DISPLAY_NAME) {
      setNameError(
        `Display name must be ${MAX_DISPLAY_NAME} characters or less.`,
      );
      return;
    }

    try {
      await updateProfile.mutateAsync({ displayName: trimmed });
      setEditingName(false);
    } catch (err) {
      setNameError(err instanceof Error ? err.message : "Failed to update.");
    }
  };

  const handleDeleteAccount = () => {
    // Check for outstanding balances
    const groupsWithBalance = (groups ?? []).filter(
      (g) => g.balanceCents !== 0,
    );

    let message = "This will permanently delete your account and all your data. This cannot be undone.";
    if (groupsWithBalance.length > 0) {
      const balanceList = groupsWithBalance
        .map((g) => `${g.name}: ${formatCents(Math.abs(g.balanceCents))}`)
        .join("\n");
      message = `You have outstanding balances:\n\n${balanceList}\n\nDeleting your account will not settle these debts. Are you sure?`;
    }

    Alert.alert("Delete account", message, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete my account",
        style: "destructive",
        onPress: () => {
          Alert.alert(
            "Final confirmation",
            "This is irreversible. Are you absolutely sure?",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Yes, delete",
                style: "destructive",
                onPress: async () => {
                  try {
                    await deleteAccount.mutateAsync();
                    router.replace("/(auth)/login");
                  } catch (err) {
                    Alert.alert(
                      "Error",
                      err instanceof Error
                        ? err.message
                        : "Failed to delete account.",
                    );
                  }
                },
              },
            ],
          );
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#faf9f7] dark:bg-[#0c0a09]">
        <LoadingSpinner text="Loading settings..." />
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
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text className="mb-6 text-xl font-bold tracking-tight text-stone-900 dark:text-white">
            Settings
          </Text>

          <View className="gap-3">
            {/* Email */}
            <Card className="px-4 py-3">
              <Text className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                Email
              </Text>
              <Text className="mt-1 text-sm text-stone-700 dark:text-stone-300">
                {user?.email}
              </Text>
            </Card>

            {/* Display name */}
            <Card className="px-4 py-3">
              <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                Display name
              </Text>
              {editingName ? (
                <View className="gap-2">
                  <Input
                    value={displayName}
                    onChangeText={(text) => {
                      setDisplayName(text);
                      setNameError(null);
                    }}
                    maxLength={MAX_DISPLAY_NAME}
                    autoFocus
                    error={nameError ?? undefined}
                  />
                  <View className="flex-row gap-2">
                    <View className="flex-1">
                      <Button
                        variant="ghost"
                        onPress={() => setEditingName(false)}
                      >
                        Cancel
                      </Button>
                    </View>
                    <View className="flex-1">
                      <Button
                        onPress={handleSaveName}
                        loading={updateProfile.isPending}
                      >
                        Save
                      </Button>
                    </View>
                  </View>
                </View>
              ) : (
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm text-stone-700 dark:text-stone-300">
                    {profile?.displayName ?? "—"}
                  </Text>
                  <Button variant="ghost" onPress={startEditName}>
                    Edit
                  </Button>
                </View>
              )}
            </Card>

            {/* Dark mode */}
            <Card className="flex-row items-center justify-between px-4 py-3">
              <Text className="text-sm text-stone-700 dark:text-stone-300">
                Dark mode
              </Text>
              <Text className="text-xs text-stone-400 dark:text-stone-500">
                {colorScheme === "dark" ? "On" : "Off"} (follows system)
              </Text>
            </Card>
          </View>

          {/* Actions */}
          <View className="mt-8 gap-3">
            <Button variant="secondary" onPress={signOut}>
              Log out
            </Button>

            <Button
              variant="danger"
              onPress={handleDeleteAccount}
              loading={deleteAccount.isPending}
            >
              Delete account
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
