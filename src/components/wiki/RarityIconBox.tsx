import Image from 'next/image';

/** Icon padding within its box, in px — kept in sync with the default `size`'s own 12px inset. */
const ICON_PADDING = 12;

export function RarityIconBox({
  iconUrl,
  accentColor,
  size = 64,
}: {
  iconUrl: string | null;
  accentColor: string;
  /** Box edge length in px. Image is inset by {@link ICON_PADDING} on each side. */
  size?: number;
}) {
  if (!iconUrl) return null;
  const imageSize = size - ICON_PADDING;
  return (
    <div
      className="mx-auto grid shrink-0 place-items-center overflow-hidden rounded-lg border-2 bg-card"
      style={{ borderColor: accentColor, width: size, height: size }}
    >
      <Image
        src={iconUrl}
        alt=""
        width={imageSize}
        height={imageSize}
        unoptimized
        className="object-contain"
        style={{ width: imageSize, height: imageSize }}
      />
    </div>
  );
}
