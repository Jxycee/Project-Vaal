import Image from 'next/image';

/** Ornamental section break for the wiki's tooltip-style detail cards. */
export function TooltipDivider() {
  return (
    <Image
      src="/ornaments/divider.png"
      alt=""
      width={1096}
      height={182}
      className="mx-auto h-auto w-24 opacity-60"
    />
  );
}
