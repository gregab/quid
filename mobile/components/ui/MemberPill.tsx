import { View, Text, Image } from "react-native";

interface MemberPillProps {
  emoji: string;
  displayName: string;
  isCurrentUser?: boolean;
  avatarUrl?: string | null;
}

export function MemberPill({
  emoji,
  displayName,
  isCurrentUser = false,
  avatarUrl,
}: MemberPillProps) {
  return (
    <View
      className={`flex-row items-center gap-1.5 rounded-full border px-3 py-1.5 ${
        isCurrentUser
          ? "border-amber-200 bg-amber-50 dark:border-amber-700/50 dark:bg-amber-900/30"
          : "border-stone-200 bg-stone-50 dark:border-stone-700 dark:bg-stone-800"
      }`}
    >
      {avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          style={{ width: 18, height: 18, borderRadius: 9 }}
        />
      ) : (
        <Text className="text-sm">{emoji}</Text>
      )}
      <Text
        className={`text-xs font-semibold tracking-tight ${
          isCurrentUser
            ? "text-amber-800 dark:text-amber-200"
            : "text-stone-600 dark:text-stone-300"
        }`}
        numberOfLines={1}
      >
        {displayName}
      </Text>
    </View>
  );
}
