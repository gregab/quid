import { useState, useMemo } from "react";
import {
  View,
  Text,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  Moon,
  Pencil,
  Shield,
  FileText,
  Trash2,
  AlertTriangle,
} from "lucide-react-native";
import { useAuth } from "../../../lib/auth";
import { useColorSchemePreference } from "../../../lib/colorScheme";
import { useToast } from "../../../lib/toast";
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

function SettingsRow({
  icon,
  label,
  value,
  onPress,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className="flex-row items-center gap-3 px-4 py-3.5"
    >
      <View
        className={`h-8 w-8 items-center justify-center rounded-lg ${danger ? "bg-red-100 dark:bg-red-900/30" : "bg-stone-100 dark:bg-stone-800"}`}
      >
        {icon}
      </View>
      <View className="min-w-0 flex-1">
        <Text
          className={`text-sm ${danger ? "font-semibold text-red-600 dark:text-red-400" : "text-stone-800 dark:text-stone-200"}`}
        >
          {label}
        </Text>
      </View>
      {value && (
        <Text className="text-sm text-stone-400 dark:text-stone-500">
          {value}
        </Text>
      )}
      {onPress && !danger && <ChevronRight size={16} color="#d6d3d1" />}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const { data: profile, isLoading } = useCurrentUser();
  const { data: groups } = useGroups();
  const updateProfile = useUpdateProfile();
  const deleteAccount = useDeleteAccount();

  const { preference, cyclePreference } = useColorSchemePreference();

  const { showToast } = useToast();

  const [editingName, setEditingName] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);

  const groupsWithDebt = useMemo(
    () => (groups ?? []).filter((g) => Math.abs(g.balanceCents) > 0),
    [groups],
  );

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
    if (groupsWithDebt.length > 0) {
      Alert.alert(
        "Can't delete account",
        `You have outstanding balances in ${groupsWithDebt.length} group${groupsWithDebt.length > 1 ? "s" : ""}. Settle up in all groups before deleting your account.`,
        [{ text: "Got it" }],
      );
      return;
    }

    Alert.alert(
      "Delete account",
      "This will permanently delete your account and all your data. This cannot be undone.",
      [
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
                      showToast({
                        message:
                          err instanceof Error
                            ? err.message
                            : "Failed to delete account.",
                        type: "error",
                      });
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
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
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-stone-100 px-4 pb-3 pt-2 dark:border-stone-800/60">
        <Pressable
          onPress={() => router.back()}
          className="flex-row items-center gap-1"
        >
          <ChevronLeft size={20} color="#78716c" />
          <Text className="text-sm text-stone-500">Back</Text>
        </Pressable>
        <Text className="text-base font-semibold text-stone-900 dark:text-white">
          Settings
        </Text>
        {/* Spacer to center title */}
        <View style={{ width: 52 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Profile header */}
          <View className="mb-6 items-center">
            <View className="mb-3 h-20 w-20 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
              <Text className="text-3xl">
                {profile?.defaultEmoji ?? "🐦"}
              </Text>
            </View>
            <Text className="text-lg font-bold text-stone-900 dark:text-white">
              {profile?.displayName ?? "—"}
            </Text>
            <Text className="mt-0.5 text-sm text-stone-500 dark:text-stone-400">
              {user?.email}
            </Text>
          </View>

          {/* Account section */}
          <Text className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
            Account
          </Text>
          <Card className="mb-6 overflow-hidden">
            {editingName ? (
              <View className="gap-2 px-4 py-3">
                <Input
                  label="Display name"
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
                      size="sm"
                      onPress={() => setEditingName(false)}
                    >
                      Cancel
                    </Button>
                  </View>
                  <View className="flex-1">
                    <Button
                      size="sm"
                      onPress={handleSaveName}
                      loading={updateProfile.isPending}
                    >
                      Save
                    </Button>
                  </View>
                </View>
              </View>
            ) : (
              <SettingsRow
                icon={<Pencil size={16} color="#78716c" />}
                label="Display name"
                value={profile?.displayName ?? "—"}
                onPress={startEditName}
              />
            )}
            <View className="mx-4 border-b border-stone-100 dark:border-stone-800" />
            <SettingsRow
              icon={<Moon size={16} color="#78716c" />}
              label="Dark mode"
              value={
                preference === "system"
                  ? "System"
                  : preference === "dark"
                    ? "On"
                    : "Off"
              }
              onPress={cyclePreference}
            />
          </Card>

          {/* Legal section */}
          <Text className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
            Legal
          </Text>
          <Card className="mb-6 overflow-hidden">
            <SettingsRow
              icon={<Shield size={16} color="#78716c" />}
              label="Privacy Policy"
              onPress={() =>
                Linking.openURL("https://aviary.gregbigelow.com/privacy")
              }
            />
            <View className="mx-4 border-b border-stone-100 dark:border-stone-800" />
            <SettingsRow
              icon={<FileText size={16} color="#78716c" />}
              label="Terms of Service"
              onPress={() =>
                Linking.openURL("https://aviary.gregbigelow.com/terms")
              }
            />
          </Card>

          {/* Danger zone */}
          <Text className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
            Danger zone
          </Text>

          {/* Outstanding balances warning */}
          {groupsWithDebt.length > 0 && (
            <View className="mb-3 flex-row items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/40 dark:bg-amber-900/20">
              <AlertTriangle size={16} color="#d97706" style={{ marginTop: 1 }} />
              <View className="min-w-0 flex-1">
                <Text className="text-sm font-semibold text-amber-800 dark:text-amber-400">
                  Outstanding balances
                </Text>
                <Text className="mt-0.5 text-xs leading-relaxed text-amber-700 dark:text-amber-500">
                  You have unsettled balances in{" "}
                  {groupsWithDebt.length === 1
                    ? `1 group (${formatCents(Math.abs(groupsWithDebt[0].balanceCents))})`
                    : `${groupsWithDebt.length} groups`}
                  . Settle up before deleting your account.
                </Text>
              </View>
            </View>
          )}

          <Card className="mb-4 overflow-hidden border border-red-100 dark:border-red-900/30">
            <View className="px-4 py-3">
              <View className="mb-3 flex-row items-center gap-2">
                <View className="h-8 w-8 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
                  <Trash2 size={16} color="#dc2626" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-red-600 dark:text-red-400">
                    Delete account
                  </Text>
                  <Text className="text-xs text-stone-500 dark:text-stone-400">
                    Permanently removes all your data
                  </Text>
                </View>
              </View>
              <Button
                variant="danger"
                onPress={handleDeleteAccount}
                loading={deleteAccount.isPending}
              >
                Delete my account
              </Button>
            </View>
          </Card>

          {/* Sign out */}
          <Button
            variant="ghost"
            onPress={signOut}
          >
            <View className="flex-row items-center gap-2">
              <LogOut size={16} color="#78716c" />
              <Text className="text-sm font-semibold text-stone-600 dark:text-stone-400">
                Sign out
              </Text>
            </View>
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
