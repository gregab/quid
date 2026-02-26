import { View, Text, useColorScheme } from "react-native";
import { getGroupColor } from "../../lib/queries/shared";

type ThumbnailSize = "sm" | "md" | "lg";

interface GroupThumbnailProps {
  emoji?: string | null;
  colorIndex: number;
  size?: ThumbnailSize;
}

const sizeMap: Record<ThumbnailSize, { box: number; text: string }> = {
  sm: { box: 36, text: "text-base" },
  md: { box: 44, text: "text-lg" },
  lg: { box: 56, text: "text-2xl" },
};

export function GroupThumbnail({
  emoji,
  colorIndex,
  size = "md",
}: GroupThumbnailProps) {
  const colorScheme = useColorScheme();
  const color = getGroupColor(colorIndex);
  const { box, text } = sizeMap[size];
  const bg = colorScheme === "dark" ? color.darkBg : color.bg;

  return (
    <View
      style={{ width: box, height: box, backgroundColor: bg }}
      className="items-center justify-center rounded-xl"
      testID="group-thumbnail"
    >
      <Text className={text}>{emoji ?? "🐦"}</Text>
    </View>
  );
}
