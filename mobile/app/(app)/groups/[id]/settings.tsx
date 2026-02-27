import { useState, useMemo } from "react";
import { View, Text, Pressable, Alert, Share, Image, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ChevronLeft,
  ChevronRight,
  Link as LinkIcon,
  UserPlus,
  LogOut,
  Users,
  Hash,
  ImageIcon,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../../../../lib/auth";
import { useToast } from "../../../../lib/toast";
import {
  useGroupDetail,
  useGroupExpenses,
  useLeaveGroup,
  useUpdateGroup,
  useUploadGroupBanner,
} from "../../../../lib/queries";
import { LoadingSpinner } from "../../../../components/ui/LoadingSpinner";
import { Button } from "../../../../components/ui/Button";
import { Input } from "../../../../components/ui/Input";
import {
  getUserDebtCents,
  formatCents,
} from "../../../../lib/queries/shared";

function SettingsRow({
  icon,
  label,
  value,
  onPress,
  danger = false,
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
      className="flex-row items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3.5 dark:border-stone-800 dark:bg-stone-900"
    >
      {icon}
      <Text
        className={`flex-1 text-sm font-medium ${
          danger
            ? "text-rose-600 dark:text-rose-400"
            : "text-stone-700 dark:text-stone-300"
        }`}
      >
        {label}
      </Text>
      {value && (
        <Text className="text-sm text-stone-400 dark:text-stone-500">
          {value}
        </Text>
      )}
      {onPress && !danger && <ChevronRight size={16} color="#a8a29e" />}
    </Pressable>
  );
}

export default function GroupSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { data: group, isLoading } = useGroupDetail(id!);
  const { data: expenses } = useGroupExpenses(id!);
  const leaveGroup = useLeaveGroup(id!);

  const { showToast } = useToast();
  const updateGroup = useUpdateGroup(id!);
  const uploadBanner = useUploadGroupBanner(id!);

  const [leaving, setLeaving] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");

  const outstandingCents = useMemo(() => {
    if (!expenses || !user) return 0;
    return getUserDebtCents(expenses, user.id);
  }, [expenses, user]);

  const bannerUrl = (group as Record<string, unknown> | undefined)?.bannerUrl as
    | string
    | null
    | undefined;

  const handlePickBanner = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [3, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    try {
      await uploadBanner.mutateAsync({
        uri: asset.uri,
        mimeType: asset.mimeType ?? "image/jpeg",
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast({ message: "Banner updated!", type: "success" });
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : "Failed to upload banner.",
        type: "error",
      });
    }
  };

  const groupName = (group as Record<string, unknown> | undefined)?.name as
    | string
    | undefined;
  const inviteToken = (group as Record<string, unknown> | undefined)
    ?.inviteToken as string | undefined;
  const memberCount = (
    (group as Record<string, unknown> | undefined)?.GroupMember as
      | unknown[]
      | undefined
  )?.length ?? 0;

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    try {
      await updateGroup.mutateAsync({ name: trimmed });
      setEditingName(false);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : "Failed to update name.",
        type: "error",
      });
    }
  };

  const handleShareInvite = async () => {
    if (!inviteToken) return;
    const url = `https://aviary.gregbigelow.com/invite/${inviteToken}`;
    try {
      await Share.share({ message: `Join my group on Aviary: ${url}` });
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // User cancelled
    }
  };

  const handleLeave = () => {
    if (outstandingCents > 0) {
      showToast({
        message: `You owe ${formatCents(outstandingCents)} in this group. Please settle up before leaving.`,
        type: "info",
      });
      return;
    }

    Alert.alert(
      "Leave group",
      `Are you sure you want to leave "${groupName}"?${
        memberCount === 1
          ? " Since you're the last member, this will delete the group."
          : ""
      }`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: async () => {
            setLeaving(true);
            try {
              await leaveGroup.mutateAsync();
              void Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
              router.replace("/(app)/(dashboard)");
            } catch (err) {
              setLeaving(false);
              showToast({
                message: err instanceof Error
                  ? err.message
                  : "Failed to leave group.",
                type: "error",
              });
            }
          },
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#faf9f7] dark:bg-[#0c0a09]">
        <LoadingSpinner />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#faf9f7] dark:bg-[#0c0a09]">
      {/* Header */}
      <View
        style={{ paddingTop: insets.top + 8 }}
        className="flex-row items-center justify-between border-b border-stone-100 px-4 pb-3 dark:border-stone-800/60"
      >
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
        <View style={{ width: 60 }} />
      </View>

      <View className="flex-1 px-4 pt-6">
        {/* Group info section */}
        <Text className="mb-2.5 text-xs font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500">
          Group info
        </Text>
        <View className="mb-6 gap-2">
          {editingName ? (
            <View className="rounded-xl border border-stone-200 bg-white px-4 py-3 dark:border-stone-800 dark:bg-stone-900">
              <Input
                label="Group name"
                value={nameInput}
                onChangeText={setNameInput}
                autoFocus
              />
              <View className="mt-3 flex-row gap-2">
                <View className="flex-1">
                  <Button variant="secondary" onPress={() => setEditingName(false)}>
                    Cancel
                  </Button>
                </View>
                <View className="flex-1">
                  <Button onPress={handleSaveName} loading={updateGroup.isPending}>
                    Save
                  </Button>
                </View>
              </View>
            </View>
          ) : (
            <SettingsRow
              icon={<Hash size={18} color="#78716c" />}
              label="Group name"
              value={groupName}
              onPress={() => {
                setNameInput(groupName ?? "");
                setEditingName(true);
              }}
            />
          )}
          <SettingsRow
            icon={<Users size={18} color="#78716c" />}
            label="Members"
            value={`${memberCount}`}
          />
        </View>

        {/* Banner section */}
        <Text className="mb-2.5 text-xs font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500">
          Banner
        </Text>
        <View className="mb-6">
          <Pressable
            onPress={handlePickBanner}
            disabled={uploadBanner.isPending}
            className="overflow-hidden rounded-xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900"
            testID="banner-upload-button"
          >
            {bannerUrl ? (
              <View>
                <Image
                  source={{ uri: bannerUrl }}
                  style={{ width: "100%", height: 100, borderTopLeftRadius: 12, borderTopRightRadius: 12 }}
                  resizeMode="cover"
                  testID="banner-preview"
                />
                <View className="flex-row items-center justify-center gap-2 py-2.5">
                  {uploadBanner.isPending ? (
                    <ActivityIndicator size="small" color="#d97706" />
                  ) : (
                    <ImageIcon size={14} color="#d97706" />
                  )}
                  <Text className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                    {uploadBanner.isPending ? "Uploading..." : "Change banner"}
                  </Text>
                </View>
              </View>
            ) : (
              <View className="flex-row items-center gap-3 px-4 py-3.5">
                {uploadBanner.isPending ? (
                  <ActivityIndicator size="small" color="#d97706" />
                ) : (
                  <ImageIcon size={18} color="#78716c" />
                )}
                <Text className="flex-1 text-sm font-medium text-stone-700 dark:text-stone-300">
                  {uploadBanner.isPending ? "Uploading..." : "Add banner image"}
                </Text>
                <ChevronRight size={16} color="#a8a29e" />
              </View>
            )}
          </Pressable>
        </View>

        {/* Actions section */}
        <Text className="mb-2.5 text-xs font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500">
          Actions
        </Text>
        <View className="mb-6 gap-2">
          <SettingsRow
            icon={<LinkIcon size={18} color="#d97706" />}
            label="Share invite link"
            onPress={handleShareInvite}
          />
          <SettingsRow
            icon={<UserPlus size={18} color="#d97706" />}
            label="Add member by email"
            onPress={() =>
              router.push(`/(app)/groups/${id}/add-member`)
            }
          />
        </View>

        {/* Danger zone */}
        <View className="mt-auto" style={{ paddingBottom: insets.bottom + 16 }}>
          <Text className="mb-2.5 text-xs font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500">
            Danger zone
          </Text>
          <Pressable
            onPress={handleLeave}
            disabled={leaving}
            className="flex-row items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3.5 dark:border-rose-900 dark:bg-rose-950/30"
          >
            <LogOut size={18} color="#e11d48" />
            <Text className="flex-1 text-sm font-medium text-rose-600 dark:text-rose-400">
              {leaving ? "Leaving..." : "Leave group"}
            </Text>
          </Pressable>
          {outstandingCents > 0 && (
            <Text className="mt-2 text-center text-xs text-rose-500 dark:text-rose-400">
              You owe {formatCents(outstandingCents)} — settle up first
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}
