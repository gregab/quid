import { generateGroupPattern } from "@/lib/groupPattern";

export function GroupThumbnail({
  groupId,
  bannerUrl,
  size = 44,
}: {
  groupId: string;
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

  const { lightSvg, darkSvg } = generateGroupPattern(groupId, size);

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
