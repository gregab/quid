import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { X } from "lucide-react-native";
import { useCreateGroup } from "../../../lib/queries";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { MAX_GROUP_NAME } from "../../../lib/queries/shared";

const GROUP_EMOJIS = [
  "🏠", "🌴", "✈️", "🎮", "🍕", "🎵", "🏋️", "🐾",
  "🐦", "🌿", "🏕️", "🎉",
];

export default function CreateGroupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const createGroup = useCreateGroup();
  const [name, setName] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Group name is required.");
      return;
    }
    if (trimmed.length > MAX_GROUP_NAME) {
      setError(`Group name must be ${MAX_GROUP_NAME} characters or less.`);
      return;
    }

    try {
      const groupId = await createGroup.mutateAsync({
        name: trimmed,
        emoji: selectedEmoji ?? undefined,
      });
      router.replace(`/(app)/groups/${groupId}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create group.",
      );
    }
  };

  return (
    <View className="flex-1 bg-[#faf9f7] dark:bg-[#0c0a09]">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Header */}
        <View
          style={{ paddingTop: insets.top + 8 }}
          className="flex-row items-center justify-between border-b border-stone-100 px-4 pb-3 dark:border-stone-800/60"
        >
          <View style={{ width: 36 }} />
          <Text className="text-base font-semibold text-stone-900 dark:text-white">
            New Group
          </Text>
          <Pressable
            onPress={() => router.back()}
            className="h-9 w-9 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800"
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <X size={18} color="#78716c" />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Emoji picker */}
          <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
            Icon
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-6"
          >
            <View className="flex-row gap-2">
              {GROUP_EMOJIS.map((emoji) => {
                const isSelected = selectedEmoji === emoji;
                return (
                  <Pressable
                    key={emoji}
                    onPress={() =>
                      setSelectedEmoji(isSelected ? null : emoji)
                    }
                    className={`h-12 w-12 items-center justify-center rounded-xl ${
                      isSelected
                        ? "border-2 border-amber-500 bg-amber-100 dark:bg-amber-900/40"
                        : "border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900"
                    }`}
                    accessibilityRole="button"
                    accessibilityLabel={emoji}
                  >
                    <Text className="text-xl">{emoji}</Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {/* Group name */}
          <View className="gap-4">
            <Input
              label="Group name"
              placeholder="Roommates, Trip to Paris, etc."
              value={name}
              onChangeText={(text) => {
                setName(text);
                setError(null);
              }}
              maxLength={MAX_GROUP_NAME}
              autoFocus
              error={error ?? undefined}
            />

            <Text className="text-xs text-stone-400 dark:text-stone-500">
              {name.length}/{MAX_GROUP_NAME}
            </Text>
          </View>
        </ScrollView>

        {/* Bottom submit button */}
        <View
          style={{ paddingBottom: insets.bottom + 16 }}
          className="border-t border-stone-100 px-4 pt-3 dark:border-stone-800/60"
        >
          <Button
            onPress={handleSubmit}
            loading={createGroup.isPending}
            disabled={!name.trim()}
            size="lg"
          >
            Create group
          </Button>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
