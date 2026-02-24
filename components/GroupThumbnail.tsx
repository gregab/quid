import { generateGroupPattern } from "@/lib/groupPattern";

export function GroupThumbnail({
  patternSeed,
  bannerUrl,
  size = 44,
}: {
  patternSeed: number;
  bannerUrl: string | null;
  size?: number;
}) {
  if (bannerUrl) {
    return (
      <img
        src={bannerUrl}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        className="flex-shrink-0 rounded-lg object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  const { lightSvg, darkSvg } = generateGroupPattern(patternSeed, size);

  return (
    <div className="flex-shrink-0" style={{ width: size, height: size }}>
      <div
        className="rounded-lg overflow-hidden dark:hidden"
        dangerouslySetInnerHTML={{ __html: lightSvg }}
      />
      <div
        className="rounded-lg overflow-hidden hidden dark:block"
        dangerouslySetInnerHTML={{ __html: darkSvg }}
      />
    </div>
  );
}
