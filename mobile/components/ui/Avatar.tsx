import { View, Text, Image } from "react-native";

type AvatarSize = "sm" | "md" | "lg";

interface AvatarProps {
  imageUrl?: string | null;
  emoji?: string;
  size?: AvatarSize;
}

const sizeClasses: Record<AvatarSize, { container: string; text: string }> = {
  sm: { container: "h-7 w-7", text: "text-sm" },
  md: { container: "h-9 w-9", text: "text-lg" },
  lg: { container: "h-12 w-12", text: "text-2xl" },
};

export function Avatar({ imageUrl, emoji, size = "md" }: AvatarProps) {
  const styles = sizeClasses[size];

  return (
    <View
      className={`items-center justify-center overflow-hidden rounded-full bg-amber-100 dark:bg-amber-900/30 ${styles.container}`}
    >
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          className="h-full w-full"
          resizeMode="cover"
        />
      ) : (
        <Text className={styles.text}>{emoji ?? "🐦"}</Text>
      )}
    </View>
  );
}
