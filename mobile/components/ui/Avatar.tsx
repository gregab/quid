import { View, Text, Image } from "react-native";

type AvatarSize = "sm" | "md" | "lg";

interface AvatarProps {
  /** User-set profile picture (highest priority) */
  profilePictureUrl?: string | null;
  /** Google/OAuth avatar URL (second priority) */
  imageUrl?: string | null;
  /** Assigned emoji (third priority) */
  emoji?: string;
  size?: AvatarSize;
}

const sizeClasses: Record<AvatarSize, { container: string; text: string }> = {
  sm: { container: "h-7 w-7", text: "text-sm" },
  md: { container: "h-9 w-9", text: "text-lg" },
  lg: { container: "h-12 w-12", text: "text-2xl" },
};

/**
 * Avatar with priority: profilePictureUrl → imageUrl (Google) → emoji.
 * Never falls back to 🐦.
 */
export function Avatar({ profilePictureUrl, imageUrl, emoji, size = "md" }: AvatarProps) {
  const styles = sizeClasses[size];
  const resolvedImageUrl = profilePictureUrl ?? imageUrl ?? null;

  return (
    <View
      className={`items-center justify-center overflow-hidden rounded-full bg-amber-100 dark:bg-amber-900/30 ${styles.container}`}
    >
      {resolvedImageUrl ? (
        <Image
          source={{ uri: resolvedImageUrl }}
          className="h-full w-full"
          resizeMode="cover"
        />
      ) : (
        <Text className={styles.text}>{emoji ?? ""}</Text>
      )}
    </View>
  );
}
