import Image from 'next/image';

export function RarityIconBox({
  iconUrl,
  accentColor,
}: {
  iconUrl: string | null;
  accentColor: string;
}) {
  if (!iconUrl) return null;
  return (
    <div
      className="grid size-16 shrink-0 place-items-center rounded-lg border-2 bg-card"
      style={{ borderColor: accentColor }}
    >
      <Image src={iconUrl} alt="" width={52} height={52} unoptimized />
    </div>
  );
}
