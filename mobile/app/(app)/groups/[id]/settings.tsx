import { useState, useMemo, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  Alert,
  Share,
  Image,
  ActivityIndicator,
  ScrollView,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ChevronLeft,
  ChevronRight,
  Link as LinkIcon,
  UserPlus,
  LogOut,
  Trash2,
  Users,
  Pencil,
  ImageIcon,
  Check,
  X,
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
  useDeleteGroup,
  useUploadGroupBanner,
} from "../../../../lib/queries";
import { LoadingSpinner } from "../../../../components/ui/LoadingSpinner";
import { Input } from "../../../../components/ui/Input";
import {
  getUserDebtCents,
  formatCents,
} from "../../../../lib/queries/shared";
import { PressableRow } from "../../../../components/ui/PressableRow";

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <Text className="mb-2 ml-1 text-[10px] font-bold uppercase tracking-[0.12em] text-stone-400 dark:text-stone-500">
      {title}
    </Text>
  );
}

// ─── Action row ───────────────────────────────────────────────────────────────

function ActionRow({
  icon,
  label,
  value,
  onPress,
  danger = false,
  testID,
  disabled = false,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  testID?: string;
  disabled?: boolean;
}) {
  const textClass = danger
    ? "text-rose-600 dark:text-rose-400"
    : "text-stone-800 dark:text-stone-200";

  const containerClass = danger
    ? "flex-row items-center gap-3 rounded-2xl border border-rose-200/80 bg-rose-50/60 px-4 py-3.5 dark:border-rose-900/60 dark:bg-rose-950/20"
    : "flex-row items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3.5 dark:border-stone-800 dark:bg-stone-900";

  const inner = (
    <>
      <View className="w-5 items-center">{icon}</View>
      <Text className={`flex-1 text-[15px] font-medium ${textClass}`}>
        {label}
      </Text>
      {value !== undefined && (
        <Text className="text-sm text-stone-400 dark:text-stone-500">
          {value}
        </Text>
      )}
      {onPress && !danger && <ChevronRight size={15} color="#a8a29e" />}
    </>
  );

  if (onPress && !disabled) {
    return (
      <PressableRow onPress={onPress} className={containerClass} testID={testID}>
        {inner}
      </PressableRow>
    );
  }

  return (
    <View
      className={`${containerClass} ${disabled ? "opacity-60" : ""}`}
      testID={testID}
    >
      {inner}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

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
  const deleteGroup = useDeleteGroup(id!);
  const uploadBanner = useUploadGroupBanner(id!);

  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");

  const nameInputRef = useRef<TextInput>(null);

  const outstandingCents = useMemo(() => {
    if (!expenses || !user) return 0;
    return getUserDebtCents(expenses, user.id);
  }, [expenses, user]);

  const bannerUrl = (group as Record<string, unknown> | undefined)?.bannerUrl as
    | string
    | null
    | undefined;

  const groupName = (group as Record<string, unknown> | undefined)?.name as
    | string
    | undefined;
  const createdById = (group as Record<string, unknown> | undefined)
    ?.createdById as string | undefined;
  const isCreator = !!user && !!createdById && user.id === createdById;
  const inviteToken = (group as Record<string, unknown> | undefined)
    ?.inviteToken as string | undefined;
  const memberCount = (
    (group as Record<string, unknown> | undefined)?.GroupMember as
      | unknown[]
      | undefined
  )?.length ?? 0;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const startNameEdit = () => {
    setNameInput(groupName ?? "");
    setEditingName(true);
    setTimeout(() => nameInputRef.current?.focus(), 150);
  };

  const cancelNameEdit = () => {
    setEditingName(false);
    setNameInput("");
  };

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
      Alert.alert(
        "Can't leave yet",
        `You have an outstanding balance of ${formatCents(outstandingCents)} in this group. Settle up before leaving.`,
        [{ text: "Got it", style: "cancel" }],
      );
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
                message:
                  err instanceof Error ? err.message : "Failed to leave group.",
                type: "error",
              });
            }
          },
        },
      ],
    );
  };

  const handleDeleteGroup = () => {
    Alert.alert(
      "Delete group",
      `Are you sure you want to permanently delete "${groupName}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteGroup.mutateAsync();
              void Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
              router.replace("/(app)/(dashboard)");
            } catch (err) {
              setDeleting(false);
              showToast({
                message:
                  err instanceof Error
                    ? err.message
                    : "Failed to delete group.",
                type: "error",
              });
            }
          },
        },
      ],
    );
  };

  // ── Loading ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#faf9f7] dark:bg-[#0c0a09]">
        <LoadingSpinner />
      </View>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

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

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Group Info ───────────────────────────────────────── */}
        <SectionHeader title="Group Info" />
        <View className="mb-6 gap-2">
          {/* Group name row — tappable, transitions to inline edit */}
          {editingName ? (
            <View className="rounded-2xl border border-amber-300 bg-white px-4 py-3.5 shadow-sm dark:border-amber-700/60 dark:bg-stone-900">
              <Input
                ref={nameInputRef}
                label="Group name"
                value={nameInput}
                onChangeText={setNameInput}
                returnKeyType="done"
                onSubmitEditing={handleSaveName}
              />
              <View className="mt-3 flex-row gap-2">
                <Pressable
                  onPress={cancelNameEdit}
                  className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 py-2.5 dark:border-stone-700 dark:bg-stone-800"
                >
                  <X size={14} color="#78716c" />
                  <Text className="text-sm font-medium text-stone-600 dark:text-stone-400">
                    Cancel
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleSaveName}
                  disabled={updateGroup.isPending}
                  className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-amber-500 py-2.5 dark:bg-amber-600"
                >
                  {updateGroup.isPending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Check size={14} color="#fff" />
                  )}
                  <Text className="text-sm font-semibold text-white">
                    {updateGroup.isPending ? "Saving…" : "Save"}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <PressableRow
              onPress={startNameEdit}
              className="flex-row items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3.5 dark:border-stone-800 dark:bg-stone-900"
            >
              <View className="w-5 items-center">
                <Pencil size={16} color="#78716c" />
              </View>
              <Text className="flex-1 text-[15px] font-medium text-stone-800 dark:text-stone-200">
                {groupName}
              </Text>
              <Text className="text-xs text-stone-400 dark:text-stone-500">
                Tap to edit
              </Text>
            </PressableRow>
          )}

          {/* Member count — static display row */}
          <ActionRow
            icon={<Users size={16} color="#78716c" />}
            label="Members"
            value={`${memberCount}`}
          />
        </View>

        {/* ── Cover Photo ──────────────────────────────────────── */}
        <SectionHeader title="Banner" />
        <View className="mb-6">
          <Pressable
            onPress={handlePickBanner}
            disabled={uploadBanner.isPending}
            className="overflow-hidden rounded-2xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900"
            testID="banner-upload-button"
          >
            {bannerUrl ? (
              <View>
                <Image
                  source={{ uri: bannerUrl }}
                  style={{
                    width: "100%",
                    height: 108,
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                  }}
                  resizeMode="cover"
                  testID="banner-preview"
                />
                <View className="flex-row items-center justify-center gap-2 py-3">
                  {uploadBanner.isPending ? (
                    <ActivityIndicator size="small" color="#d97706" />
                  ) : (
                    <ImageIcon size={13} color="#d97706" />
                  )}
                  <Text className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                    {uploadBanner.isPending ? "Uploading…" : "Change banner"}
                  </Text>
                </View>
              </View>
            ) : (
              <View className="flex-row items-center gap-3 px-4 py-3.5">
                {uploadBanner.isPending ? (
                  <ActivityIndicator size="small" color="#d97706" />
                ) : (
                  <View className="w-5 items-center">
                    <ImageIcon size={16} color="#78716c" />
                  </View>
                )}
                <Text className="flex-1 text-[15px] font-medium text-stone-700 dark:text-stone-300">
                  {uploadBanner.isPending ? "Uploading…" : "Add banner image"}
                </Text>
                <ChevronRight size={15} color="#a8a29e" />
              </View>
            )}
          </Pressable>
        </View>

        {/* ── Actions ──────────────────────────────────────────── */}
        <SectionHeader title="Actions" />
        <View className="mb-6 gap-2">
          <ActionRow
            icon={<LinkIcon size={16} color="#d97706" />}
            label="Share invite link"
            onPress={handleShareInvite}
          />
          <ActionRow
            icon={<UserPlus size={16} color="#d97706" />}
            label="Add member by email"
            onPress={() => router.push(`/(app)/groups/${id}/add-member`)}
          />
        </View>

        {/* ── Danger Zone ──────────────────────────────────────── */}
        <SectionHeader title="Danger Zone" />
        <View className="gap-2">
          <ActionRow
            icon={
              leaving ? (
                <ActivityIndicator size="small" color="#e11d48" />
              ) : (
                <LogOut size={16} color="#e11d48" />
              )
            }
            label={leaving ? "Leaving…" : "Leave group"}
            onPress={handleLeave}
            danger
            disabled={leaving}
          />
          {isCreator && (
            <ActionRow
              icon={
                deleting ? (
                  <ActivityIndicator size="small" color="#e11d48" />
                ) : (
                  <Trash2 size={16} color="#e11d48" />
                )
              }
              label={deleting ? "Deleting…" : "Delete group"}
              onPress={handleDeleteGroup}
              danger
              disabled={deleting}
              testID="delete-group-button"
            />
          )}

          {outstandingCents > 0 && (
            <View className="mt-1 flex-row items-start gap-2 rounded-xl border border-rose-200/70 bg-rose-50/60 px-3.5 py-3 dark:border-rose-900/40 dark:bg-rose-950/20">
              <Text className="mt-0.5 text-rose-500 dark:text-rose-400">⚠</Text>
              <Text className="flex-1 text-xs leading-relaxed text-rose-600 dark:text-rose-400">
                You owe {formatCents(outstandingCents)} in this group — settle up first
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
