import { View, Image, useColorScheme } from "react-native";
import { SvgXml } from "react-native-svg";
import { generateGroupPattern } from "../../lib/queries/shared";

type ThumbnailSize = "sm" | "md" | "lg";

interface GroupThumbnailProps {
  patternSeed: number | null;
  bannerUrl: string | null;
  size?: ThumbnailSize;
}

const sizeMap: Record<ThumbnailSize, number> = {
  sm: 36,
  md: 44,
  lg: 56,
};

export function GroupThumbnail({
  patternSeed,
  bannerUrl,
  size = "md",
}: GroupThumbnailProps) {
  const colorScheme = useColorScheme();
  const box = sizeMap[size];

  if (bannerUrl) {
    return (
      <Image
        source={{ uri: bannerUrl }}
        style={{ width: box, height: box, borderRadius: 10 }}
        testID="group-thumbnail"
      />
    );
  }

  const { lightSvg, darkSvg } = generateGroupPattern(patternSeed ?? 0, box);
  const svg = colorScheme === "dark" ? darkSvg : lightSvg;

  return (
    <View
      style={{ width: box, height: box, borderRadius: 10, overflow: "hidden" }}
      testID="group-thumbnail"
    >
      <SvgXml xml={svg} width={box} height={box} />
    </View>
  );
}
