import Image from 'next/image';

/** Icon padding within its box, in px — kept in sync with the default `size`'s own 12px inset. */
const ICON_PADDING = 12;

export function RarityIconBox({
  iconUrl,
  accentColor,
  size = 64,
  iconWidth,
  iconHeight,
}: {
  iconUrl: string | null;
  accentColor: string;
  /** Box's longest edge in px — the box is not forced square. Image is inset by {@link ICON_PADDING} on each side. */
  size?: number;
  /**
   * Intrinsic icon dimensions (post-resize, aspect-ratio preserved) — most
   * weapon/armour art is portrait, not square, e.g. a real crossbow icon is
   * 65x128. Rendering those at a forced size x size box squeezes them down
   * to a fraction of the box's width, looking much smaller than a square
   * item's icon at the same `size`. Passing the real dimensions renders the
   * icon at its own proportions, capped to `size` on the longer edge, and
   * the box hugs that shape instead of a fixed square. Falls back to a
   * square box when unavailable (older data, or no icon).
   */
  iconWidth?: number | null;
  iconHeight?: number | null;
}) {
  if (!iconUrl) return null;
  const naturalW = iconWidth ?? size;
  const naturalH = iconHeight ?? size;
  const scale = size / Math.max(naturalW, naturalH);
  const imageW = Math.round(naturalW * scale);
  const imageH = Math.round(naturalH * scale);
  return (
    <div
      className="mx-auto grid shrink-0 place-items-center overflow-hidden rounded-lg border-2 bg-card"
      style={{ borderColor: accentColor, width: imageW + ICON_PADDING, height: imageH + ICON_PADDING }}
    >
      <Image
        src={iconUrl}
        alt=""
        width={imageW}
        height={imageH}
        unoptimized
        className="object-contain"
        style={{ width: imageW, height: imageH }}
      />
    </div>
  );
}
