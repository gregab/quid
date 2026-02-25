import { useState } from "react";
import { View, Text, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useCreateGroup } from "../../../lib/queries";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { MAX_GROUP_NAME } from "../../../lib/queries/shared";

export default function CreateGroupScreen() {
  const router = useRouter();
  const createGroup = useCreateGroup();
  const [name, setName] = useState("");
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
      const groupId = await createGroup.mutateAsync(trimmed);
      router.replace(`/(app)/groups/${groupId}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create group.",
      );
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#faf9f7] dark:bg-[#0c0a09]">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View className="flex-1 px-4 pt-4">
          {/* Header */}
          <View className="mb-6 flex-row items-center justify-between">
            <Text className="text-xl font-bold tracking-tight text-stone-900 dark:text-white">
              Create a group
            </Text>
            <Button variant="ghost" onPress={() => router.back()}>
              Cancel
            </Button>
          </View>

          {/* Form */}
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

            <Button
              onPress={handleSubmit}
              loading={createGroup.isPending}
              disabled={!name.trim()}
            >
              Create group
            </Button>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
